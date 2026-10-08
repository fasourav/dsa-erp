import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
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
    payrollLines,
    payrollRuns,
    bank,
    receivables,
    payables,
    backlogs,
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
          .select("id, work_type")
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
          .from("payroll_lines")
          .select(
            "net_salary, basic_salary, allowance, bonus, deductions, payroll_run_id",
          )
          .order("id", { ascending: true })
          .range(from, to),
      "Payroll list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("payroll_runs")
          .select("id, period_year, period_month, paid_on")
          .order("id", { ascending: true })
          .range(from, to),
      "Payroll run list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("bank_transactions")
          .select("amount, direction, transaction_date")
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
  ])

  const purchaseOrderByInvoice = new Map(
    invoices.map((invoice) => [invoice.id, invoice.purchase_order_id]),
  )
  const workTypeByOrder = new Map(
    purchaseOrders.map((order) => [order.id, order.work_type]),
  )
  const openByStatus = new Map(statuses.map((status) => [status.code, status.is_open]))
  const payrollRunById = new Map(payrollRuns.map((run) => [run.id, run]))
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
    vendorPayments: vendorPayments.map((payment) => ({
      date: payment.paid_on,
      amount: toNumber(payment.amount),
      workType:
        workTypeByOrder.get(purchaseOrderByInvoice.get(payment.vendor_invoice_id) ?? "") ??
        null,
    })),
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
    payroll: payrollLines.flatMap((line) => {
      const run = payrollRunById.get(line.payroll_run_id)
      if (!run) return []
      const net =
        line.net_salary == null
          ? toNumber(line.basic_salary) +
            toNumber(line.allowance) +
            toNumber(line.bonus) -
            toNumber(line.deductions)
          : toNumber(line.net_salary)
      return [{ date: payrollDate(run), amount: net }]
    }),
    bank: bank.flatMap((transaction) => {
      if (transaction.direction !== "inflow" && transaction.direction !== "outflow") {
        return []
      }
      return [
        {
          date: transaction.transaction_date,
          amount: toNumber(transaction.amount),
          direction: transaction.direction,
        },
      ]
    }),
    billed: receivables.reduce((total, row) => total + toNumber(row.billed_amount), 0),
    ledgerPaid: receivables.reduce((total, row) => total + toNumber(row.paid), 0),
    receivables: receivables.reduce((total, row) => total + toNumber(row.due), 0),
    payables: payables.reduce((total, row) => total + toNumber(row.pending_payable), 0),
    backlogCount: backlogIds.size,
  }
}

function payrollDate(run: {
  period_year: number
  period_month: number
  paid_on: string | null
}): string {
  // Runs without a paid date are placed on the first day of the payroll period.
  if (run.paid_on && /^\d{4}-\d{2}-\d{2}/.test(run.paid_on)) {
    return run.paid_on.slice(0, 10)
  }
  return `${run.period_year}-${String(run.period_month).padStart(2, "0")}-01`
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
