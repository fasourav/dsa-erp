import { fetchAllPages } from "@/lib/fetch-pages"
import { normalizeLaunchDate, toNumber } from "@/lib/format"
import {
  buildDashboard,
  type DashboardInput,
  type DashboardModel,
} from "@/lib/dashboard-metrics"
import { createClient } from "@/lib/supabase/server"

export async function getDashboard(now = new Date()): Promise<{
  model: DashboardModel | null
  error: string | null
}> {
  try {
    const input = await loadDashboardInput()
    return { model: buildDashboard(input, now), error: null }
  } catch (error) {
    return { model: null, error: messageOf(error) }
  }
}

async function loadDashboardInput(): Promise<DashboardInput> {
  const supabase = await createClient()
  const feed = await supabase.rpc("dashboard_feed")
  if (!feed.error && feed.data) {
    return inputFromFeed(feed.data)
  }
  if (feed.error && isMissingFeed(feed.error)) {
    return loadDashboardRows()
  }
  if (feed.error) throw feed.error
  throw new Error("Could not load the dashboard.")
}

function isMissingFeed(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    /could not find the function/i.test(error.message ?? "")
  )
}

function inputFromFeed(data: unknown): DashboardInput {
  const feed = asRecord(data)
  return {
    projects: asArray(feed.projects).map((row) => {
      const project = asRecord(row)
      return {
        totalValue: toNumber(project.total_value),
        status: project.status === "completed" ? "completed" : "active",
        startedOn: typeof project.started_on === "string" ? project.started_on : "",
        year: typeof project.year === "number" ? project.year : null,
      }
    }),
    clientCount: toNumber(feed.client_count),
    leads: asArray(feed.leads).map((row) => {
      const lead = asRecord(row)
      return {
        status: typeof lead.status === "string" ? lead.status : "",
        estimatedValue: toNumber(lead.estimated_value),
        isOpen: lead.is_open === true,
      }
    }),
    revenue: datedRows(feed.revenue),
    vendorPayments: asArray(feed.vendor_payments).map((row) => {
      const payment = asRecord(row)
      return {
        date: typeof payment.date === "string" ? payment.date : "",
        amount: toNumber(payment.amount),
        workType: typeof payment.work_type === "string" ? payment.work_type : null,
        projectLinked: payment.project_linked !== false,
      }
    }),
    operational: asArray(feed.operational).map((row) => {
      const expense = asRecord(row)
      return {
        date: typeof expense.date === "string" ? expense.date : "",
        amount: toNumber(expense.amount),
        category: typeof expense.category === "string" ? expense.category : "",
        projectLinked: expense.project_linked === true,
      }
    }),
    taxes: datedRows(feed.taxes),
    bank: asArray(feed.bank).flatMap((row) => {
      const transaction = asRecord(row)
      const date = typeof transaction.date === "string" ? transaction.date : ""
      const sourceKind =
        typeof transaction.source_kind === "string" ? transaction.source_kind : ""
      const direction = transaction.direction
      if (!date || !sourceKind || (direction !== "inflow" && direction !== "outflow")) {
        return []
      }
      return [
        {
          date,
          amount: toNumber(transaction.amount),
          direction,
          sourceKind,
        },
      ]
    }),
    openingBalance: toNumber(feed.opening_balance),
    billed: toNumber(feed.billed),
    ledgerPaid: toNumber(feed.ledger_paid),
    receivables: toNumber(feed.receivables),
    payables: toNumber(feed.payables),
    backlogCount: toNumber(feed.backlog_count),
    launchDate: normalizeLaunchDate(
      typeof feed.launch_date === "string" ? feed.launch_date : null,
    ),
  }
}

function datedRows(value: unknown): { date: string; amount: number }[] {
  return asArray(value).map((row) => {
    const entry = asRecord(row)
    return {
      date: typeof entry.date === "string" ? entry.date : "",
      amount: toNumber(entry.amount),
    }
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

async function loadDashboardRows(): Promise<DashboardInput> {
  const supabase = await createClient()

  const [
    projects,
    clientCount,
    leads,
    statuses,
    payments,
    vendorPayments,
    invoices,
    purchaseOrders,
    operational,
    taxes,
    bankAccounts,
    bank,
    receivables,
    payables,
    backlogs,
    companySettings,
  ] = await Promise.all([
    fetchAllPages(
      (from, to) =>
        supabase
          .from("projects")
          .select("total_value, status, started_on, year")
          .order("id", { ascending: true })
          .range(from, to),
      "Project list is larger than expected.",
    ),
    countClients(supabase),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("leads")
          .select("status, estimated_value")
          .order("id", { ascending: true })
          .range(from, to),
      "Lead list is larger than expected.",
    ),
    loadLeadStatuses(supabase),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("client_payments")
          .select("amount, paid_on")
          .order("id", { ascending: true })
          .range(from, to),
      "Income list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("vendor_payments")
          .select("amount, paid_on, vendor_invoice_id")
          .order("id", { ascending: true })
          .range(from, to),
      "Vendor payment list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("vendor_invoices")
          .select("id, purchase_order_id")
          .order("id", { ascending: true })
          .range(from, to),
      "Vendor invoice list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("vendor_purchase_orders")
          .select("id, work_type, project_id")
          .order("id", { ascending: true })
          .range(from, to),
      "Purchase order list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("operational_expenses")
          .select("amount, expense_date, category, project_id")
          .order("id", { ascending: true })
          .range(from, to),
      "Operational expense list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("vat_tax_payments")
          .select("amount, paid_on")
          .order("id", { ascending: true })
          .range(from, to),
      "Tax payment list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("bank_accounts_readable")
          .select("opening_balance")
          .order("id", { ascending: true })
          .range(from, to),
      "Bank account list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("bank_transactions_readable")
          .select("amount, direction, transaction_date, source_kind")
          .order("id", { ascending: true })
          .range(from, to),
      "Bank ledger is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("accounts_receivable")
          .select("billed_amount, paid, due")
          .order("id", { ascending: true })
          .range(from, to),
      "Receivable list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("accounts_payable")
          .select("pending_payable")
          .order("id", { ascending: true })
          .range(from, to),
      "Payable list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("project_backlogs")
          .select("project_id")
          .order("project_id", { ascending: true })
          .range(from, to),
      "Backlog list is larger than expected.",
    ),
    supabase
      .from("company_settings")
      .select("launch_date")
      .eq("id", true)
      .maybeSingle(),
  ])

  const purchaseOrderByInvoice = new Map(
    invoices.map((invoice) => [invoice.id, invoice.purchase_order_id]),
  )
  const orderById = new Map(purchaseOrders.map((order) => [order.id, order]))
  const openByStatus = new Map(statuses.map((status) => [status.code, status.is_open]))
  const backlogIds = new Set(
    backlogs.flatMap((row) => (row.project_id ? [row.project_id] : [])),
  )

  return {
    projects: projects.map((project) => ({
      totalValue: toNumber(project.total_value),
      status: project.status === "completed" ? "completed" : "active",
      startedOn: project.started_on,
      year: project.year,
    })),
    clientCount,
    leads: leads.map((lead) => ({
      status: lead.status,
      estimatedValue: toNumber(lead.estimated_value),
      isOpen: openByStatus.get(lead.status) ?? false,
    })),
    revenue: payments.map((payment) => ({
      date: payment.paid_on,
      amount: toNumber(payment.amount),
    })),
    vendorPayments: vendorPayments.map((payment) => {
      const order = orderById.get(
        purchaseOrderByInvoice.get(payment.vendor_invoice_id) ?? "",
      )
      return {
        date: payment.paid_on,
        amount: toNumber(payment.amount),
        workType: order?.work_type ?? null,
        // A payment whose purchase order is missing keeps the project-cost path.
        projectLinked: order ? order.project_id != null : true,
      }
    }),
    operational: operational.map((expense) => ({
      date: expense.expense_date,
      amount: toNumber(expense.amount),
      category: expense.category,
      projectLinked: expense.project_id != null,
    })),
    taxes: taxes.map((payment) => ({
      date: payment.paid_on,
      amount: toNumber(payment.amount),
    })),
    bank: bank.flatMap((transaction) => {
      if (
        !transaction.transaction_date ||
        !transaction.source_kind ||
        (transaction.direction !== "inflow" && transaction.direction !== "outflow")
      ) {
        return []
      }
      return [
        {
          date: transaction.transaction_date,
          amount: toNumber(transaction.amount),
          direction: transaction.direction,
          sourceKind: transaction.source_kind,
        },
      ]
    }),
    openingBalance: bankAccounts.reduce(
      (total, account) => total + toNumber(account.opening_balance),
      0,
    ),
    billed: receivables.reduce((total, row) => total + toNumber(row.billed_amount), 0),
    ledgerPaid: receivables.reduce((total, row) => total + toNumber(row.paid), 0),
    receivables: receivables.reduce((total, row) => total + toNumber(row.due), 0),
    payables: payables.reduce((total, row) => total + toNumber(row.pending_payable), 0),
    backlogCount: backlogIds.size,
    launchDate: normalizeLaunchDate(companySettings.data?.launch_date),
  }
}

async function countClients(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<number> {
  const { count, error } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
  if (error) throw error
  return count ?? 0
}

async function loadLeadStatuses(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ code: string; is_open: boolean }[]> {
  const { data, error } = await supabase.from("lead_statuses").select("code, is_open")
  if (error) throw error
  return data ?? []
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message
  ) {
    return error.message
  }
  return "Could not load the dashboard."
}
