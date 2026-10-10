import {
  isBankDirection,
  isBankSourceKind,
  withRunningBalances,
  type AccountFilter,
  type BankAccountRow,
  type BankTransactionRow,
} from "@/lib/bank"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { isUuid } from "@/lib/ids"
import type { NamedOption } from "@/lib/operational-expenses"
import { dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import { mergeCategorySuggestions } from "@/lib/vendor-summary"

export async function getBankPage(accountId: string | null): Promise<{
  accounts: BankAccountRow[]
  transactions: BankTransactionRow[]
  projects: NamedOption[]
  paymentMethods: string[]
  accountFilter: AccountFilter | null
  error: string | null
}> {
  const empty = {
    accounts: [] as BankAccountRow[],
    transactions: [] as BankTransactionRow[],
    projects: [] as NamedOption[],
    paymentMethods: [] as string[],
    accountFilter: null,
    error: "Could not load bank accounts.",
  }
  const supabase = await createClient()

  try {
    const [accountRows, transactionRows, projectRows, methodRows] =
      await Promise.all([
        fetchAllPages(
          (from, to) =>
            supabase
              .from("bank_accounts")
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
              .from("bank_transactions")
              .select(
                "id, bank_account_id, transaction_date, direction, amount, source_kind, payment_method, project_id, notes, income_id, vendor_payment_id, operational_expense_id, vat_tax_payment_id, payroll_line_id, transfer_id",
              )
              .order("id", { ascending: true })
              .range(from, to),
          "Bank transaction list is larger than expected.",
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

    const accounts = accountRows.map((row) => ({
      id: row.id,
      name: row.name?.trim() ?? "",
      accountHolderName: row.account_holder_name?.trim() ?? "",
      accountNumber: row.account_number?.trim() ?? "",
      bankName: row.bank_name?.trim() ?? "",
      routingNumber: row.routing_number?.trim() ?? "",
      address: row.address?.trim() ?? "",
      openingBalance: toNumber(row.opening_balance),
      currency: row.currency?.trim() ?? "",
      isActive: row.is_active,
      sortOrder: row.sort_order,
    }))
    const accountsById = new Map(accounts.map((account) => [account.id, account]))
    const projects = projectRows
      .map((row) => ({ id: row.id, name: row.name?.trim() ?? "" }))
      .sort((left, right) =>
        left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
      )
    const projectsById = new Map(projects.map((project) => [project.id, project.name]))

    const openingByAccount = new Map(
      accounts.map((account) => [account.id, account.openingBalance]),
    )
    const transactions = withRunningBalances(transactionRows.flatMap((row) => {
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
          transactionDate: dateInputValue(row.transaction_date),
          direction: row.direction,
          amount: toNumber(row.amount),
          sourceKind: row.source_kind,
          paymentMethod: row.payment_method?.trim() ?? "",
          projectId: row.project_id ?? "",
          projectName: row.project_id ? projectsById.get(row.project_id) ?? "" : "",
          notes: row.notes ?? "",
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
    }), openingByAccount)

    const requestedId = accountId && isUuid(accountId) ? accountId : null
    if (accountId && !requestedId) {
      return {
        accounts,
        transactions: [],
        projects,
        paymentMethods: methodRows.map((row) => row.name),
        accountFilter: null,
        error: "That bank account could not be found.",
      }
    }

    const matched = requestedId ? accountsById.get(requestedId) ?? null : null
    if (requestedId && !matched) {
      return {
        accounts,
        transactions: [],
        projects,
        paymentMethods: methodRows.map((row) => row.name),
        accountFilter: null,
        error: "That bank account could not be found.",
      }
    }

    return {
      accounts,
      transactions,
      projects,
      paymentMethods: mergeCategorySuggestions(
        methodRows.map((row) => row.name),
        transactions.map((row) => row.paymentMethod),
      ),
      accountFilter: matched ? { id: matched.id, name: matched.name } : null,
      error: null,
    }
  } catch {
    return empty
  }
}
