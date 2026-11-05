import {
  bankDirectionLabel,
  bankDirections,
  bankFlowLabel,
  bankSourceKinds,
  bankSourceLabel,
  compareLedgerOrder,
  defaultBankTransactionSort,
  isBankDirection,
  isBankSourceKind,
  withRunningBalances,
  type AccountFilter,
  type BankAccountRow,
  type BankTransactionColumnId,
  type BankTransactionRow,
} from "@/lib/bank"
import type { SortState } from "@/lib/list-paging"
import { fetchAllPages, fetchPage } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { isUuid } from "@/lib/ids"
import type { NamedOption } from "@/lib/operational-expenses"
import {
  LIST_PAGE_SIZE,
  parseSearchAmount,
  parseSearchIsoDate,
  sanitizeSearch,
} from "@/lib/page-query"
import { moneyCents } from "@/lib/payment-status"
import { dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import { mergeCategorySuggestions } from "@/lib/vendor-summary"

const TRANSACTION_SELECT =
  "id, bank_account_id, transaction_date, created_at, direction, amount, source_kind, payment_method, project_id, notes, income_id, vendor_payment_id, operational_expense_id, vat_tax_payment_id, payroll_line_id, transfer_id"

// Searchable bank transaction columns: notes (ILIKE), payment_method (ILIKE),
// account name / bank name / account number / holder (via bank_account_id),
// project name (via project_id), direction key/label, source_kind key/label,
// transaction_date (ISO date), and exact transaction amount.
function buildBankOrFilter(
  rawQuery: string,
  term: string,
  accounts: readonly BankAccountRow[],
  projects: readonly NamedOption[],
): string | null {
  const clauses: string[] = []
  const lower = term.toLowerCase()

  if (term) {
    clauses.push(`notes.ilike.%${term}%`, `payment_method.ilike.%${term}%`)

    const matchingAccountIds = accounts
      .filter((account) => {
        const haystack = `${account.name} ${account.bankName} ${account.accountNumber} ${account.accountHolderName}`.toLowerCase()
        return haystack.includes(lower)
      })
      .slice(0, 200)
      .map((account) => account.id)
    if (matchingAccountIds.length > 0) {
      clauses.push(`bank_account_id.in.(${matchingAccountIds.join(",")})`)
    }

    const matchingProjectIds = projects
      .filter((project) => project.name.toLowerCase().includes(lower))
      .slice(0, 200)
      .map((project) => project.id)
    if (matchingProjectIds.length > 0) {
      clauses.push(`project_id.in.(${matchingProjectIds.join(",")})`)
    }

    const matchingDirections = bankDirections.filter(
      (dir) =>
        dir.includes(lower) ||
        bankDirectionLabel(dir).toLowerCase().includes(lower) ||
        bankFlowLabel(dir).toLowerCase().includes(lower),
    )
    if (matchingDirections.length > 0) {
      clauses.push(`direction.in.(${matchingDirections.join(",")})`)
    }

    const matchingSources = bankSourceKinds.filter(
      (kind) =>
        kind.replace(/_/g, " ").includes(lower) ||
        kind.includes(lower) ||
        bankSourceLabel(kind).toLowerCase().includes(lower) ||
        (kind === "vendor_expense" &&
          "operational expense (po)".includes(lower)),
    )
    if (matchingSources.length > 0) {
      clauses.push(`source_kind.in.(${matchingSources.join(",")})`)
    }

    const isoDate = parseSearchIsoDate(term)
    if (isoDate) {
      clauses.push(`transaction_date.eq.${isoDate}`)
    }
  }

  const amount = parseSearchAmount(rawQuery)
  if (amount !== null) {
    clauses.push(`amount.eq.${amount}`)
  }

  return clauses.length > 0 ? clauses.join(",") : null
}

type RawBankTransactionRow = {
  id: string | null
  bank_account_id: string | null
  transaction_date: string | null
  created_at: string | null
  direction: string | null
  amount: number | null
  source_kind: string | null
  payment_method: string | null
  project_id: string | null
  notes: string | null
  income_id: string | null
  vendor_payment_id: string | null
  operational_expense_id: string | null
  vat_tax_payment_id: string | null
  payroll_line_id: string | null
  transfer_id: string | null
}

function mapTransactionRow(
  row: RawBankTransactionRow,
  accountsById: ReadonlyMap<string, BankAccountRow>,
  projectsById: ReadonlyMap<string, string>,
  balanceById: ReadonlyMap<string, number>,
): BankTransactionRow[] {
  if (!row.id || !row.direction || !row.source_kind) return []
  if (!isBankDirection(row.direction) || !isBankSourceKind(row.source_kind)) {
    return []
  }
  const account = row.bank_account_id
    ? accountsById.get(row.bank_account_id)
    : undefined
  return [
    {
      id: row.id,
      bankAccountId: row.bank_account_id ?? "",
      accountName: account?.name ?? "",
      transactionDate: dateInputValue(row.transaction_date ?? ""),
      createdAt: row.created_at ?? "",
      direction: row.direction,
      amount: toNumber(row.amount),
      sourceKind: row.source_kind,
      paymentMethod: row.payment_method?.trim() ?? "",
      projectId: row.project_id ?? "",
      projectName: row.project_id ? projectsById.get(row.project_id) ?? "" : "",
      notes: row.notes ?? "",
      balance: balanceById.get(row.id) ?? 0,
      linked: Boolean(
        row.income_id ||
          row.vendor_payment_id ||
          row.operational_expense_id ||
          row.vat_tax_payment_id ||
          row.payroll_line_id,
      ),
      transferId: row.transfer_id ?? "",
    },
  ]
}

function computeBalances(
  accounts: readonly BankAccountRow[],
  balanceRows: ReadonlyArray<{
    id: string | null
    bank_account_id: string | null
    transaction_date: string | null
    created_at: string | null
    direction: string | null
    amount: number | null
    source_kind: string | null
  }>,
) {
  const openingByAccount = new Map(
    accounts.map((account) => [account.id, account.openingBalance]),
  )
  const accountBalances: Record<string, number> = Object.fromEntries(
    accounts.map((account) => [account.id, account.openingBalance]),
  )
  const balanceById = new Map<string, number>()

  const groupedNarrow = new Map<
    string,
    Array<{
      id: string
      bankAccountId: string
      transactionDate: string
      createdAt: string
      direction: "inflow" | "outflow"
      amount: number
    }>
  >()

  for (const row of balanceRows) {
    if (!row.id || !row.direction || !row.source_kind) continue
    if (!isBankDirection(row.direction) || !isBankSourceKind(row.source_kind)) continue
    const item = {
      id: row.id,
      bankAccountId: row.bank_account_id ?? "",
      transactionDate: dateInputValue(row.transaction_date ?? ""),
      createdAt: row.created_at ?? "",
      direction: row.direction,
      amount: toNumber(row.amount),
    }
    const key = item.bankAccountId || item.id
    const list = groupedNarrow.get(key) ?? []
    list.push(item)
    groupedNarrow.set(key, list)
  }

  for (const group of groupedNarrow.values()) {
    const ordered = [...group].sort(compareLedgerOrder)
    const accId = ordered[0]?.bankAccountId ?? ""
    let cents = moneyCents(openingByAccount.get(accId) ?? 0)
    for (const item of ordered) {
      const signed =
        item.direction === "inflow"
          ? moneyCents(item.amount)
          : -moneyCents(item.amount)
      cents += signed
      balanceById.set(item.id, cents / 100)
    }
    if (accId) {
      accountBalances[accId] = cents / 100
    }
  }

  return { openingByAccount, accountBalances, balanceById }
}

export async function getBankPage(
  accountId: string | null,
  options: {
    q?: string
    page?: number
    sort?: SortState<BankTransactionColumnId>
    includeReportRows?: boolean
  } = {},
): Promise<{
  accounts: BankAccountRow[]
  accountBalances: Record<string, number>
  transactions: BankTransactionRow[]
  reportTransactions: BankTransactionRow[]
  projects: NamedOption[]
  paymentMethods: string[]
  accountFilter: AccountFilter | null
  total: number
  page: number
  pageCount: number
  error: string | null
}> {
  const empty = {
    accounts: [] as BankAccountRow[],
    accountBalances: {} as Record<string, number>,
    transactions: [] as BankTransactionRow[],
    reportTransactions: [] as BankTransactionRow[],
    projects: [] as NamedOption[],
    paymentMethods: [] as string[],
    accountFilter: null,
    total: 0,
    page: 1,
    pageCount: 1,
    error: "Could not load bank accounts.",
  }
  const supabase = await createClient()
  const requestedId = accountId && isUuid(accountId) ? accountId : null
  const requestedPage = options.page ?? 1
  const rawQuery = options.q ?? ""
  const term = sanitizeSearch(rawQuery)
  const sort = options.sort ?? defaultBankTransactionSort
  const ascending = sort.direction === "asc"

  try {
    const [accountRows, balanceRows, projectRows, methodRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("bank_accounts_readable")
            .select(
              "id, name, account_holder_name, account_number, bank_name, routing_number, address, opening_balance, currency, is_active, sort_order",
            )
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        "Bank account list is larger than expected.",
      ),
      // Narrow column projection solely for computing exact running and closing account balances.
      fetchAllPages(
        (from, to) =>
          supabase
            .from("bank_transactions_readable")
            .select(
              "id, bank_account_id, transaction_date, created_at, direction, amount, source_kind",
            )
            .order("transaction_date", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        "Bank balance ledger is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("projects")
            .select("id, name")
            .order("id", { ascending: true })
            .range(from, to),
        "Project list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("payment_methods")
            .select("name, sort_order")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        "Payment method list is larger than expected.",
      ),
    ])

    const accounts = accountRows.flatMap((row) => {
      if (!row.id) return []
      return [
        {
          id: row.id,
          name: row.name?.trim() ?? "",
          accountHolderName: row.account_holder_name?.trim() ?? "",
          accountNumber: row.account_number?.trim() ?? "",
          bankName: row.bank_name?.trim() ?? "",
          routingNumber: row.routing_number?.trim() ?? "",
          address: row.address?.trim() ?? "",
          openingBalance: toNumber(row.opening_balance),
          currency: row.currency?.trim() ?? "",
          isActive: row.is_active ?? true,
          sortOrder: row.sort_order ?? 0,
        },
      ]
    })
    const accountsById = new Map(accounts.map((account) => [account.id, account]))
    const projects = projectRows
      .map((row) => ({ id: row.id, name: row.name?.trim() ?? "" }))
      .sort((left, right) =>
        left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
      )
    const projectsById = new Map(projects.map((project) => [project.id, project.name]))

    const { openingByAccount, accountBalances, balanceById } = computeBalances(
      accounts,
      balanceRows,
    )

    if (accountId && !requestedId) {
      return {
        accounts,
        accountBalances,
        transactions: [],
        reportTransactions: [],
        projects,
        paymentMethods: methodRows.map((row) => row.name),
        accountFilter: null,
        total: 0,
        page: 1,
        pageCount: 1,
        error: "That bank account could not be found.",
      }
    }

    const matched = requestedId ? accountsById.get(requestedId) ?? null : null
    if (requestedId && !matched) {
      return {
        accounts,
        accountBalances,
        transactions: [],
        reportTransactions: [],
        projects,
        paymentMethods: methodRows.map((row) => row.name),
        accountFilter: null,
        total: 0,
        page: 1,
        pageCount: 1,
        error: "That bank account could not be found.",
      }
    }

    const orFilter = buildBankOrFilter(rawQuery, term, accounts, projects)

    const txSlice = await fetchPage(
      (from, to) => {
        let query = supabase
          .from("bank_transactions_readable")
          .select(TRANSACTION_SELECT, { count: "exact" })

        if (matched) {
          query = query.eq("bank_account_id", matched.id)
        }
        if (orFilter) {
          query = query.or(orFilter)
        }

        switch (sort.key) {
          case "direction":
            query = query
              .order("direction", { ascending })
              .order("transaction_date", { ascending: false })
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
            break
          case "sourceKind":
            query = query
              .order("source_kind", { ascending })
              .order("transaction_date", { ascending: false })
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
            break
          case "amount":
            query = query
              .order("amount", { ascending })
              .order("transaction_date", { ascending: false })
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
            break
          default:
            query = query
              .order("transaction_date", { ascending })
              .order("created_at", { ascending })
              .order("id", { ascending })
            break
        }

        return query.range(from, to)
      },
      requestedPage,
      LIST_PAGE_SIZE,
    )

    const transactions = txSlice.rows.flatMap((row) =>
      mapTransactionRow(row, accountsById, projectsById, balanceById),
    )

    let reportTransactions: BankTransactionRow[] = []
    if (options.includeReportRows) {
      const reportRows = await fetchAllPages(
        (from, to) =>
          supabase
            .from("bank_transactions_readable")
            .select(TRANSACTION_SELECT)
            .order("transaction_date", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        "Bank statement report is larger than expected.",
      )
      reportTransactions = withRunningBalances(
        reportRows
          .flatMap((row) =>
            mapTransactionRow(row, accountsById, projectsById, balanceById),
          )
          .map(({ balance: _unused, ...rest }) => {
            void _unused
            return rest
          }),
        openingByAccount,
      )
    }

    return {
      accounts,
      accountBalances,
      transactions,
      reportTransactions,
      projects,
      paymentMethods: mergeCategorySuggestions(
        methodRows.map((row) => row.name),
        transactions.map((row) => row.paymentMethod),
      ),
      accountFilter: matched ? { id: matched.id, name: matched.name } : null,
      total: txSlice.total,
      page: txSlice.page,
      pageCount: txSlice.pageCount,
      error: null,
    }
  } catch {
    return empty
  }
}

export async function getAllBankTransactionsForExport(
  accountId: string | null,
  options: {
    q?: string
    sort?: SortState<BankTransactionColumnId>
  } = {},
): Promise<{
  transactions: BankTransactionRow[]
  error: string | null
}> {
  const supabase = await createClient()
  const requestedId = accountId && isUuid(accountId) ? accountId : null
  if (accountId && !requestedId) {
    return { transactions: [], error: "That bank account could not be found." }
  }
  const rawQuery = options.q ?? ""
  const term = sanitizeSearch(rawQuery)
  const sort = options.sort ?? defaultBankTransactionSort
  const ascending = sort.direction === "asc"

  try {
    const [accountRows, balanceRows, projectRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("bank_accounts_readable")
            .select(
              "id, name, account_holder_name, account_number, bank_name, routing_number, address, opening_balance, currency, is_active, sort_order",
            )
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        "Bank account list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("bank_transactions_readable")
            .select(
              "id, bank_account_id, transaction_date, created_at, direction, amount, source_kind",
            )
            .order("transaction_date", { ascending: true })
            .order("created_at", { ascending: true })
            .order("id", { ascending: true })
            .range(from, to),
        "Bank balance ledger is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("projects")
            .select("id, name")
            .order("id", { ascending: true })
            .range(from, to),
        "Project list is larger than expected.",
      ),
    ])

    const accounts = accountRows.flatMap((row) => {
      if (!row.id) return []
      return [
        {
          id: row.id,
          name: row.name?.trim() ?? "",
          accountHolderName: row.account_holder_name?.trim() ?? "",
          accountNumber: row.account_number?.trim() ?? "",
          bankName: row.bank_name?.trim() ?? "",
          routingNumber: row.routing_number?.trim() ?? "",
          address: row.address?.trim() ?? "",
          openingBalance: toNumber(row.opening_balance),
          currency: row.currency?.trim() ?? "",
          isActive: row.is_active ?? true,
          sortOrder: row.sort_order ?? 0,
        },
      ]
    })
    const accountsById = new Map(accounts.map((account) => [account.id, account]))
    if (requestedId && !accountsById.has(requestedId)) {
      return { transactions: [], error: "That bank account could not be found." }
    }
    const projects = projectRows.map((row) => ({
      id: row.id,
      name: row.name?.trim() ?? "",
    }))
    const projectsById = new Map(
      projects.map((project) => [project.id, project.name]),
    )
    const { balanceById } = computeBalances(accounts, balanceRows)
    const orFilter = buildBankOrFilter(rawQuery, term, accounts, projects)

    const txRows = await fetchAllPages(
      (from, to) => {
        let query = supabase
          .from("bank_transactions_readable")
          .select(TRANSACTION_SELECT)

        if (requestedId) {
          query = query.eq("bank_account_id", requestedId)
        }
        if (orFilter) {
          query = query.or(orFilter)
        }

        switch (sort.key) {
          case "direction":
            query = query
              .order("direction", { ascending })
              .order("transaction_date", { ascending: false })
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
            break
          case "sourceKind":
            query = query
              .order("source_kind", { ascending })
              .order("transaction_date", { ascending: false })
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
            break
          case "amount":
            query = query
              .order("amount", { ascending })
              .order("transaction_date", { ascending: false })
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
            break
          default:
            query = query
              .order("transaction_date", { ascending })
              .order("created_at", { ascending })
              .order("id", { ascending })
            break
        }

        return query.range(from, to)
      },
      "Bank transaction export is larger than expected.",
    )

    return {
      transactions: txRows.flatMap((row) =>
        mapTransactionRow(row, accountsById, projectsById, balanceById),
      ),
      error: null,
    }
  } catch {
    return { transactions: [], error: "Could not export bank transactions." }
  }
}
