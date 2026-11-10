import { listBankAccounts } from "@/lib/bank-accounts"
import type { BankAccountChoice } from "@/lib/bank-account"
import { fetchAllPages, fetchByIds, fetchPage } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { isUuid } from "@/lib/ids"
import {
  LIST_PAGE_SIZE,
  parseSearchAmount,
  parseSearchIsoDate,
  sanitizeSearch,
} from "@/lib/page-query"
import { dateInputValue } from "@/lib/project-validation"
import {
  clientInvoiceStatuses,
  clientInvoiceStatusFromPayments,
  moneyCents,
  paymentStatusLabel,
  sumAmounts,
} from "@/lib/payment-status"
import {
  parseSettlementFilter,
  type SettlementCounts,
  type SettlementFilter,
} from "@/lib/settlement-filter"
import { createClient } from "@/lib/supabase/server"
import { mergeCategorySuggestions } from "@/lib/vendor-summary"
import {
  defaultClientInvoiceSort,
  type ClientInvoiceColumnId,
  type ClientInvoiceRow,
  type ClientPaymentRow,
  type InvoiceProjectOption,
} from "@/lib/client-invoice-summary"
import type { SortState } from "@/lib/list-paging"

export type InvoiceProjectFilter = {
  id: string
  name: string
}

type InvoiceScope = {
  projectId: string | null
  orFilter: string | null
  settlement: SettlementFilter
}

const emptySettlementCounts: SettlementCounts = {
  outstanding: 0,
  settled: 0,
  all: 0,
}

/**
 * Stored status follows derived_payment_status, so this matches the open
 * balance without a second pass over payments:
 * Outstanding = partial, or unpaid with amount > 0.
 * Settled = paid, or unpaid with amount <= 0 (nothing left to collect).
 * All = every non-void invoice. Void stays out of all three.
 */
type InvoiceQuery = {
  eq: (column: string, value: string) => InvoiceQuery
  neq: (column: string, value: string) => InvoiceQuery
  or: (filters: string) => InvoiceQuery
}

function applyClientInvoiceScope<Q>(query: Q, scope: InvoiceScope): Q {
  let scoped = query as InvoiceQuery
  if (scope.projectId) {
    scoped = scoped.eq("project_id", scope.projectId)
  }
  if (scope.settlement === "all") {
    scoped = scoped.neq("status", "void")
  }

  const settlementOr =
    scope.settlement === "outstanding"
      ? "status.eq.partial,and(status.eq.unpaid,amount.gt.0)"
      : scope.settlement === "settled"
        ? "status.eq.paid,and(status.eq.unpaid,amount.lte.0)"
        : null

  if (scope.orFilter && settlementOr) {
    scoped = scoped.or(`and(or(${scope.orFilter}),or(${settlementOr}))`)
  } else if (scope.orFilter) {
    scoped = scoped.or(scope.orFilter)
  } else if (settlementOr) {
    scoped = scoped.or(settlementOr)
  }

  return scoped as Q
}

async function countClientInvoices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scope: InvoiceScope,
): Promise<SettlementCounts> {
  async function count(settlement: SettlementFilter): Promise<number> {
    const query = applyClientInvoiceScope(
      supabase
        .from("client_invoices")
        .select("id", { count: "exact", head: true }),
      { ...scope, settlement },
    )
    const { count: total, error } = await query
    if (error) {
      throw error
    }
    return total ?? 0
  }

  const [outstanding, settled, all] = await Promise.all([
    count("outstanding"),
    count("settled"),
    count("all"),
  ])
  return { outstanding, settled, all }
}

async function computeClientInvoiceTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scope: InvoiceScope,
): Promise<{ amount: number; paid: number }> {
  const rows = await fetchAllPages(
    (from, to) =>
      applyClientInvoiceScope(
        supabase
          .from("client_invoices")
          .select("id, amount")
          .order("id", { ascending: true }),
        scope,
      ).range(from, to),
    "Client invoice totals list is larger than expected.",
  )
  if (rows.length === 0) {
    return { amount: 0, paid: 0 }
  }
  const invoiceIds = rows.map((row) => row.id)
  const paymentRows = await fetchByIds(invoiceIds, (ids) =>
    supabase
      .from("client_payments")
      .select("client_invoice_id, amount")
      .in("client_invoice_id", ids)
      .order("id", { ascending: true }),
  )
  return {
    amount: sumAmounts(rows.map((row) => toNumber(row.amount))),
    paid: sumAmounts(paymentRows.map((row) => toNumber(row.amount))),
  }
}

type InvoiceRawRow = {
  id: string
  project_id: string
  client_id: string
  issued_on: string
  due_on: string | null
  amount: number
  status: string
  description: string | null
}

// Searchable invoice columns: description (ILIKE), project name (via project_id),
// client display name (via client_id), status key/label, issued_on / due_on (ISO date),
// and exact invoice amount.
function buildInvoiceOrFilter(
  rawQuery: string,
  term: string,
  projects: readonly InvoiceProjectOption[],
  clientsById: ReadonlyMap<string, string>,
): string | null {
  const clauses: string[] = []
  const lower = term.toLowerCase()

  if (term) {
    clauses.push(`description.ilike.%${term}%`)

    const matchingProjectIds = projects
      .filter(
        (project) =>
          project.name.toLowerCase().includes(lower) ||
          project.clientName.toLowerCase().includes(lower),
      )
      .slice(0, 200)
      .map((project) => project.id)
    if (matchingProjectIds.length > 0) {
      clauses.push(`project_id.in.(${matchingProjectIds.join(",")})`)
    }

    const matchingClientIds: string[] = []
    for (const [clientId, displayName] of clientsById.entries()) {
      if (displayName.toLowerCase().includes(lower)) {
        matchingClientIds.push(clientId)
        if (matchingClientIds.length >= 200) break
      }
    }
    if (matchingClientIds.length > 0) {
      clauses.push(`client_id.in.(${matchingClientIds.join(",")})`)
    }

    const matchingStatuses = clientInvoiceStatuses.filter(
      (status) =>
        status.includes(lower) ||
        paymentStatusLabel(status).toLowerCase().includes(lower),
    )
    if (matchingStatuses.length > 0) {
      clauses.push(`status.in.(${matchingStatuses.join(",")})`)
    }

    const isoDate = parseSearchIsoDate(term)
    if (isoDate) {
      clauses.push(`issued_on.eq.${isoDate}`, `due_on.eq.${isoDate}`)
    }
  }

  const amount = parseSearchAmount(rawQuery)
  if (amount !== null) {
    clauses.push(`amount.eq.${amount}`)
  }

  return clauses.length > 0 ? clauses.join(",") : null
}

async function hydrateInvoices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: readonly InvoiceRawRow[],
  projectsById: ReadonlyMap<string, InvoiceProjectOption>,
  clientsById: ReadonlyMap<string, string>,
  bankAccounts: readonly BankAccountChoice[],
): Promise<ClientInvoiceRow[]> {
  const invoiceIds = rows.map((row) => row.id)
  const paymentRows =
    invoiceIds.length === 0
      ? []
      : await fetchByIds(invoiceIds, (ids) =>
          supabase
            .from("client_payments")
            .select(
              "id, client_invoice_id, paid_on, amount, method, reference, notes, remarks, bank_account_id",
            )
            .in("client_invoice_id", ids)
            .order("id", { ascending: true }),
        )

  const accountsById = new Map(bankAccounts.map((account) => [account.id, account.name]))
  const paymentsByInvoice = new Map<string, ClientPaymentRow[]>()

  for (const row of paymentRows) {
    const payment: ClientPaymentRow = {
      id: row.id,
      paidOn: dateInputValue(row.paid_on),
      amount: toNumber(row.amount),
      method: row.method?.trim() ?? "",
      reference: row.reference?.trim() ?? "",
      notes: row.notes ?? "",
      remarks: row.remarks ?? "",
      bankAccountId: row.bank_account_id,
      bankAccountName: accountsById.get(row.bank_account_id) ?? "",
    }
    const current = paymentsByInvoice.get(row.client_invoice_id) ?? []
    current.push(payment)
    paymentsByInvoice.set(row.client_invoice_id, current)
  }

  return rows.map((row) => {
    const project = projectsById.get(row.project_id)
    const payments = paymentsByInvoice.get(row.id) ?? []
    const paid = sumAmounts(payments.map((payment) => payment.amount))
    const balance = Math.max(
      0,
      (moneyCents(toNumber(row.amount)) - moneyCents(paid)) / 100,
    )

    return {
      id: row.id,
      projectId: row.project_id,
      projectName: project?.name ?? "",
      clientId: row.client_id,
      clientName: clientsById.get(row.client_id) ?? project?.clientName ?? "",
      issuedOn: dateInputValue(row.issued_on),
      dueOn: row.due_on ? dateInputValue(row.due_on) : "",
      amount: toNumber(row.amount),
      status: clientInvoiceStatusFromPayments(toNumber(row.amount), paid),
      description: row.description ?? "",
      paid,
      balance,
      payments,
    } satisfies ClientInvoiceRow
  })
}

export async function getClientInvoices(
  projectId: string | null,
  options: {
    q?: string
    page?: number
    status?: SettlementFilter
    sort?: SortState<ClientInvoiceColumnId>
  } = {},
): Promise<{
  invoices: ClientInvoiceRow[]
  projects: InvoiceProjectOption[]
  paymentMethods: string[]
  bankAccounts: BankAccountChoice[]
  projectFilter: InvoiceProjectFilter | null
  total: number
  page: number
  pageCount: number
  counts: SettlementCounts
  totals: { amount: number; paid: number }
  error: string | null
}> {
  const empty = {
    invoices: [] as ClientInvoiceRow[],
    projects: [] as InvoiceProjectOption[],
    paymentMethods: [] as string[],
    bankAccounts: [] as BankAccountChoice[],
    projectFilter: null,
    total: 0,
    page: 1,
    pageCount: 1,
    counts: emptySettlementCounts,
    totals: { amount: 0, paid: 0 },
    error: "Could not load client invoices.",
  }

  const supabase = await createClient()
  const requestedId = projectId && isUuid(projectId) ? projectId : null
  const requestedPage = options.page ?? 1
  const rawQuery = options.q ?? ""
  const term = sanitizeSearch(rawQuery)
  const statusFilter = parseSettlementFilter(options.status)
  const sort = options.sort ?? defaultClientInvoiceSort
  const ascending = sort.direction === "asc"

  try {
    const [projectRows, clientRows, methodRows, bankAccounts] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("projects")
            .select("id, name, client_id")
            .order("id", { ascending: true })
            .range(from, to),
        "Project list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("client_summaries")
            .select("client_id, display_name")
            .order("client_id", { ascending: true })
            .range(from, to),
        "Client list is larger than expected.",
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
      listBankAccounts(),
    ])

    const clientsById = new Map(
      clientRows.flatMap((row) =>
        row.client_id ? [[row.client_id, row.display_name?.trim() ?? ""] as const] : [],
      ),
    )

    const projects = projectRows
      .map((row) => ({
        id: row.id,
        name: row.name?.trim() ?? "",
        clientId: row.client_id,
        clientName: clientsById.get(row.client_id) ?? "",
      }))
      .sort((left, right) =>
        left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
      )

    const projectsById = new Map(projects.map((project) => [project.id, project]))

    if (projectId && !requestedId) {
      return {
        invoices: [],
        projects,
        paymentMethods: methodRows.map((row) => row.name),
        bankAccounts,
        projectFilter: null,
        total: 0,
        page: 1,
        pageCount: 1,
        counts: emptySettlementCounts,
        totals: { amount: 0, paid: 0 },
        error: "That project could not be found.",
      }
    }

    const matchedProject = requestedId
      ? projectsById.get(requestedId) ?? null
      : null

    if (requestedId && !matchedProject) {
      return {
        invoices: [],
        projects,
        paymentMethods: methodRows.map((row) => row.name),
        bankAccounts,
        projectFilter: null,
        total: 0,
        page: 1,
        pageCount: 1,
        counts: emptySettlementCounts,
        totals: { amount: 0, paid: 0 },
        error: "That project could not be found.",
      }
    }

    const orFilter = buildInvoiceOrFilter(rawQuery, term, projects, clientsById)
    const scope: InvoiceScope = {
      projectId: matchedProject?.id ?? null,
      orFilter,
      settlement: statusFilter,
    }

    const [invoiceSlice, counts, totals] = await Promise.all([
      fetchPage(
      (from, to) => {
        let query = applyClientInvoiceScope(
          supabase
            .from("client_invoices")
            .select(
              "id, project_id, client_id, issued_on, due_on, amount, status, description",
              { count: "exact" },
            ),
          scope,
        )

        switch (sort.key) {
          case "amount":
            query = query
              .order("amount", { ascending })
              .order("issued_on", { ascending: false })
              .order("id", { ascending: false })
            break
          case "status":
            query = query
              .order("status", { ascending })
              .order("issued_on", { ascending: false })
              .order("id", { ascending: false })
            break
          default:
            query = query
              .order("issued_on", { ascending })
              .order("id", { ascending })
            break
        }

        return query.range(from, to)
      },
      requestedPage,
      LIST_PAGE_SIZE,
      ),
      countClientInvoices(supabase, scope),
      computeClientInvoiceTotals(supabase, scope),
    ])

    const invoices = await hydrateInvoices(
      supabase,
      invoiceSlice.rows,
      projectsById,
      clientsById,
      bankAccounts,
    )

    return {
      invoices,
      projects,
      paymentMethods: mergeCategorySuggestions(
        methodRows.map((row) => row.name),
        invoices.flatMap((invoice) =>
          invoice.payments.map((payment) => payment.method),
        ),
      ),
      bankAccounts,
      projectFilter: matchedProject
        ? { id: matchedProject.id, name: matchedProject.name }
        : null,
      total: invoiceSlice.total,
      page: invoiceSlice.page,
      pageCount: invoiceSlice.pageCount,
      counts: { ...counts, [statusFilter]: invoiceSlice.total },
      totals,
      error: null,
    }
  } catch {
    return empty
  }
}

export async function getAllClientInvoicesForExport(
  projectId: string | null,
  options: {
    q?: string
    status?: SettlementFilter
    sort?: SortState<ClientInvoiceColumnId>
  } = {},
): Promise<{
  invoices: ClientInvoiceRow[]
  error: string | null
}> {
  const supabase = await createClient()
  const requestedId = projectId && isUuid(projectId) ? projectId : null
  if (projectId && !requestedId) {
    return { invoices: [], error: "That project could not be found." }
  }
  const rawQuery = options.q ?? ""
  const term = sanitizeSearch(rawQuery)
  const statusFilter = parseSettlementFilter(options.status)
  const sort = options.sort ?? defaultClientInvoiceSort
  const ascending = sort.direction === "asc"

  try {
    const [projectRows, clientRows, bankAccounts] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("projects")
            .select("id, name, client_id")
            .order("id", { ascending: true })
            .range(from, to),
        "Project list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("client_summaries")
            .select("client_id, display_name")
            .order("client_id", { ascending: true })
            .range(from, to),
        "Client list is larger than expected.",
      ),
      listBankAccounts(),
    ])

    const clientsById = new Map(
      clientRows.flatMap((row) =>
        row.client_id ? [[row.client_id, row.display_name?.trim() ?? ""] as const] : [],
      ),
    )
    const projects = projectRows.map((row) => ({
      id: row.id,
      name: row.name?.trim() ?? "",
      clientId: row.client_id,
      clientName: clientsById.get(row.client_id) ?? "",
    }))
    const projectsById = new Map(projects.map((project) => [project.id, project]))

    if (requestedId && !projectsById.has(requestedId)) {
      return { invoices: [], error: "That project could not be found." }
    }

    const orFilter = buildInvoiceOrFilter(rawQuery, term, projects, clientsById)

    const invoiceRows = await fetchAllPages(
      (from, to) => {
        let query = applyClientInvoiceScope(
          supabase
            .from("client_invoices")
            .select(
              "id, project_id, client_id, issued_on, due_on, amount, status, description",
            ),
          {
            projectId: requestedId,
            orFilter,
            settlement: statusFilter,
          },
        )

        switch (sort.key) {
          case "amount":
            query = query
              .order("amount", { ascending })
              .order("issued_on", { ascending: false })
              .order("id", { ascending: false })
            break
          case "status":
            query = query
              .order("status", { ascending })
              .order("issued_on", { ascending: false })
              .order("id", { ascending: false })
            break
          default:
            query = query
              .order("issued_on", { ascending })
              .order("id", { ascending })
            break
        }

        return query.range(from, to)
      },
      "Client invoice export is larger than expected.",
    )

    const invoices = await hydrateInvoices(
      supabase,
      invoiceRows,
      projectsById,
      clientsById,
      bankAccounts,
    )

    return { invoices, error: null }
  } catch {
    return { invoices: [], error: "Could not export client invoices." }
  }
}
