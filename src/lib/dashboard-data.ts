import { sumAssetCurrentValue } from "@/lib/asset-value"
import { getAssets } from "@/lib/assets"
import { fetchAllPages } from "@/lib/fetch-pages"
import { normalizeLaunchDate, toNumber } from "@/lib/format"
import {
  buildDashboard,
  collectionEfficiencyOf,
  forecastedProfitOf,
  formatUpdatedAt,
  presentAnnualCaption,
  presentTenure,
  presentWeekCaption,
  projectValueCounts,
  scopedBacklogValue,
  type ChartPoint,
  type DashboardInput,
  type DashboardModel,
  type WeekPoint,
  type YearSnapshot,
} from "@/lib/dashboard-metrics"
import { createClient } from "@/lib/supabase/server"

export async function getDashboard(
  scopeYear: number | null,
  now = new Date(),
  includeAssets = false,
): Promise<{
  model: DashboardModel | null
  error: string | null
}> {
  try {
    const [scoped, details] = await Promise.all([
      loadDashboardScope(scopeYear, now),
      loadPerformanceDetails(scopeYear, includeAssets),
    ])
    const base = scoped ?? buildDashboard(await loadDashboardRows(), now, scopeYear)
    return { model: withPerformance(base, details), error: null }
  } catch (error) {
    return { model: null, error: messageOf(error) }
  }
}

type PerformanceDetails = {
  highValue: number | null
  lowValue: number | null
  backlogValue: number | null
  assetValue: number | null
}

function withPerformance(model: DashboardModel, details: PerformanceDetails): DashboardModel {
  const snapshot = model.snapshots[0]
  return {
    ...model,
    forecastedProfit: forecastedProfitOf(model.receivables, model.payables),
    performance: {
      ...model.performance,
      collectionEfficiency: collectionEfficiencyOf(snapshot?.revenue ?? 0, model.receivables),
      highValue: details.highValue ?? model.performance.highValue,
      lowValue: details.lowValue ?? model.performance.lowValue,
      backlogValue: details.backlogValue,
      assetValue: details.assetValue,
    },
  }
}

async function loadPerformanceDetails(
  scopeYear: number | null,
  includeAssets: boolean,
): Promise<PerformanceDetails> {
  const [counts, backlogValue, assetValue] = await Promise.all([
    loadProjectCounts(scopeYear),
    loadBacklogValue(scopeYear),
    includeAssets ? loadAssetTotal() : Promise.resolve<number | null>(null),
  ])

  return {
    highValue: counts?.highValue ?? null,
    lowValue: counts?.lowValue ?? null,
    backlogValue,
    assetValue,
  }
}

async function loadProjectCounts(
  scopeYear: number | null,
): Promise<{ highValue: number; lowValue: number } | null> {
  try {
    const supabase = await createClient()
    const rows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("projects")
          .select("total_value, year, started_on")
          .order("id", { ascending: true })
          .range(from, to),
      "Project list is larger than expected.",
    )
    return projectValueCounts(
      rows.map((row) => ({
        totalValue: toNumber(row.total_value),
        year: row.year,
        startedOn: row.started_on ?? "",
      })),
      scopeYear,
    )
  } catch {
    return null
  }
}

async function loadBacklogValue(scopeYear: number | null): Promise<number | null> {
  try {
    const supabase = await createClient()
    const [projectRows, backlogRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("projects")
            .select("id, year, started_on")
            .order("id", { ascending: true })
            .range(from, to),
        "Project list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("project_backlogs")
            .select("project_id, backlog_amount")
            .order("project_id", { ascending: true })
            .range(from, to),
        "Backlog list is larger than expected.",
      ),
    ])
    return scopedBacklogValue(
      projectRows.flatMap((row) => {
        if (!row.id) return []
        return [{ id: row.id, year: row.year, startedOn: row.started_on ?? "" }]
      }),
      backlogRows.flatMap((row) => {
        if (!row.project_id) return []
        return [{ projectId: row.project_id, amount: toNumber(row.backlog_amount) }]
      }),
      scopeYear,
    )
  } catch {
    return null
  }
}

async function loadAssetTotal(): Promise<number | null> {
  const assets = await getAssets()
  if (assets.error) return null
  return sumAssetCurrentValue(assets.assets.map((asset) => asset.currentValue))
}

async function loadDashboardScope(
  scopeYear: number | null,
  now: Date,
): Promise<DashboardModel | null> {
  const supabase = await createClient()
  const scope = await supabase.rpc("dashboard_scope", { p_year: scopeYear })
  if (scope.error && isMissingFeed(scope.error)) return null
  if (scope.error) throw scope.error
  if (!scope.data) throw new Error("Could not load the dashboard.")
  return modelFromScope(scope.data, now)
}

function isMissingFeed(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    /could not find the function/i.test(error.message ?? "")
  )
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
    clientRows,
    clientInvoices,
    leads,
    statuses,
    payments,
    vendorPayments,
    invoices,
    purchaseOrders,
    expenseCategories,
    officeCategories,
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
          .select("id, total_value, status, started_on, year")
          .order("id", { ascending: true })
          .range(from, to),
      "Project list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("clients")
          .select("created_at")
          .order("id", { ascending: true })
          .range(from, to),
      "Client list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("client_invoices")
          .select("id, amount, issued_on, status, project_id, client_id")
          .order("id", { ascending: true })
          .range(from, to),
      "Client invoice list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("leads")
          .select("status, estimated_value, added_on")
          .order("id", { ascending: true })
          .range(from, to),
      "Lead list is larger than expected.",
    ),
    loadLeadStatuses(supabase),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("client_payments")
          .select("amount, paid_on, client_invoice_id")
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
          .select(
            "id, work_type, project_id, issued_on, total_value, expense_category_id, office_expense_category_id",
          )
          .order("id", { ascending: true })
          .range(from, to),
      "Purchase order list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("project_expense_categories")
          .select("id, name")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
          .range(from, to),
      "Expense category list is larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("office_expense_categories")
          .select("id, name")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
          .range(from, to),
      "Office expense category list is larger than expected.",
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
  const categoryNameById = new Map(
    expenseCategories.map((category) => [category.id, category.name?.trim() ?? ""]),
  )
  const officeCategoryNameById = new Map(
    officeCategories.map((category) => [category.id, category.name?.trim() ?? ""]),
  )
  const openByStatus = new Map(statuses.map((status) => [status.code, status.is_open]))
  const backlogIds = new Set(
    backlogs.flatMap((row) => (row.project_id ? [row.project_id] : [])),
  )
  const projectYearById = new Map(
    projects.map((project) => [project.id, project.year ?? yearOf(project.started_on)]),
  )
  const paymentsByInvoice = new Map<string, { date: string; amount: number }[]>()
  for (const payment of payments) {
    const list = paymentsByInvoice.get(payment.client_invoice_id) ?? []
    list.push({ date: payment.paid_on, amount: toNumber(payment.amount) })
    paymentsByInvoice.set(payment.client_invoice_id, list)
  }
  const paymentsByOrder = new Map<string, { date: string; amount: number }[]>()
  for (const payment of vendorPayments) {
    const orderId = purchaseOrderByInvoice.get(payment.vendor_invoice_id)
    if (!orderId) continue
    const list = paymentsByOrder.get(orderId) ?? []
    list.push({ date: payment.paid_on, amount: toNumber(payment.amount) })
    paymentsByOrder.set(orderId, list)
  }

  return {
    projects: projects.map((project) => ({
      totalValue: toNumber(project.total_value),
      status: project.status === "completed" ? "completed" : "active",
      startedOn: project.started_on,
      year: project.year,
    })),
    clientCount: clientRows.length,
    clients: clientRows.map((client) => ({ createdOn: dhakaDate(client.created_at) })),
    invoices: clientInvoices.map((invoice) => ({
      issuedOn: invoice.issued_on,
      amount: toNumber(invoice.amount),
      voided: invoice.status === "void",
      payments: paymentsByInvoice.get(invoice.id) ?? [],
    })),
    orders: purchaseOrders.map((order) => ({
      issuedOn: order.issued_on,
      totalValue: toNumber(order.total_value),
      projectLinked: order.project_id != null,
      payments: paymentsByOrder.get(order.id) ?? [],
    })),
    backlogYears: [...backlogIds].flatMap((id) => {
      const year = projectYearById.get(id)
      return year == null ? [] : [year]
    }),
    leads: leads.map((lead) => ({
      status: lead.status,
      estimatedValue: toNumber(lead.estimated_value),
      isOpen: openByStatus.get(lead.status) ?? false,
      addedOn: lead.added_on,
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
        expenseCategory: order?.expense_category_id
          ? categoryNameById.get(order.expense_category_id) || null
          : null,
        officeCategory: order?.office_expense_category_id
          ? officeCategoryNameById.get(order.office_expense_category_id) || null
          : null,
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

function yearOf(iso: string): number | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Number(iso.slice(0, 4)) : null
}

function dhakaDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

async function loadLeadStatuses(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ code: string; is_open: boolean }[]> {
  const { data, error } = await supabase.from("lead_statuses").select("code, is_open")
  if (error) throw error
  return data ?? []
}

function modelFromScope(data: unknown, now: Date): DashboardModel {
  const row = asRecord(data)
  const scopeYear = typeof row.scope_year === "number" ? row.scope_year : null
  const currentYear = toNumber(row.current_year)
  const annualFirst = toNumber(row.annual_first)
  const annualLast = toNumber(row.annual_last)
  const week = asRecord(row.week)
  return {
    updatedLabel: formatUpdatedAt(now),
    updatedIso: now.toISOString(),
    scopeYear,
    scopeLabel: scopeYear == null ? "All Time" : `FY${scopeYear}`,
    defaultYear: scopeYear ?? currentYear,
    years: asArray(row.years).map((year) => toNumber(year)),
    snapshots: [snapshotFrom(row.snapshot, scopeYear ?? currentYear)],
    cashBalance: toNumber(row.cash_balance),
    cashDelta: nullableNumber(row.cash_delta),
    cashSpark: points(row.cash_spark),
    receivables: toNumber(row.receivables),
    payables: toNumber(row.payables),
    forecastedProfit: toNumber(row.forecasted_profit),
    weeks: asArray(row.weeks).map((item) => {
      const point = asRecord(item)
      return {
        label: text(point.label),
        revenue: toNumber(point.revenue),
        projectExpense: toNumber(point.project_expense),
        adminExpense: toNumber(point.admin_expense),
        totalExpense: toNumber(point.total_expense),
        netProfit: toNumber(point.net_profit),
      } satisfies WeekPoint
    }),
    weekCaption: presentWeekCaption(text(week.start), text(week.end), toNumber(week.number)),
    annual: asArray(row.annual).map((item) => {
      const point = asRecord(item)
      return { label: text(point.label), grossProfit: toNumber(point.gross_profit) }
    }),
    annualCaption: presentAnnualCaption(
      annualFirst,
      annualLast,
      currentYear,
      row.annual_monthly === true,
      scopeYear,
    ),
    trend: asArray(row.trend).map((item) => {
      const point = asRecord(item)
      return { label: text(point.label), count: toNumber(point.count) }
    }),
    trendCaption: `${toNumber(row.trend_total)} Total`,
    performance: {
      projectCount: toNumber(asRecord(row.performance).project_count),
      sinceYear: nullableNumber(asRecord(row.performance).since_year),
      active: toNumber(asRecord(row.performance).active),
      openLeads: toNumber(asRecord(row.performance).open_leads),
      clients: toNumber(asRecord(row.performance).clients),
      leadValue: toNumber(asRecord(row.performance).lead_value),
      winRate: toNumber(asRecord(row.performance).win_rate),
      collectionEfficiency: toNumber(asRecord(row.performance).collection_efficiency),
      backlog: toNumber(asRecord(row.performance).backlog),
      backlogValue: null,
      highValue: null,
      lowValue: null,
      assetValue: null,
    },
    tenure: presentTenure({
      launch: text(asRecord(row.tenure).launch),
      spanStart: text(asRecord(row.tenure).span_start),
      spanEnd: text(asRecord(row.tenure).span_end),
      scoped: scopeYear != null,
      scopeYear,
      revenuePerDay: toNumber(asRecord(row.tenure).revenue_per_day),
      netProfitPerDay: toNumber(asRecord(row.tenure).net_profit_per_day),
    }),
  }
}

function snapshotFrom(value: unknown, fallbackYear: number): YearSnapshot {
  const row = asRecord(value)
  return {
    year: typeof row.year === "number" ? row.year : fallbackYear,
    revenue: toNumber(row.revenue),
    revenueDelta: nullableNumber(row.revenue_delta),
    grossProfit: toNumber(row.gross_profit),
    grossDelta: nullableNumber(row.gross_delta),
    netProfit: toNumber(row.net_profit),
    netDelta: nullableNumber(row.net_delta),
    totalExpense: toNumber(row.total_expense),
    expenseDelta: nullableNumber(row.expense_delta),
    withdrawal: toNumber(row.withdrawal),
    material: toNumber(row.material),
    subcontractor: toNumber(row.subcontractor),
    projectOverhead: toNumber(row.project_overhead),
    tax: toNumber(row.tax),
    admin: toNumber(row.admin),
    operational: toNumber(row.operational),
    marketing: toNumber(row.marketing),
    salary: toNumber(row.salary),
    projectExpense: toNumber(row.project_expense),
    collectionRate: toNumber(row.collection_rate),
    expenseRatio: toNumber(row.expense_ratio),
    grossMargin: toNumber(row.gross_margin),
    netMargin: toNumber(row.net_margin),
    withdrawalRatio: toNumber(row.withdrawal_ratio),
    projectCostRatio: toNumber(row.project_cost_ratio),
    taxRatio: toNumber(row.tax_ratio),
    adminRatio: toNumber(row.admin_ratio),
    revenueSpark: points(row.revenue_spark),
    grossSpark: points(row.gross_spark),
    netSpark: points(row.net_spark),
    expenseSpark: points(row.expense_spark),
  }
}

function points(value: unknown): ChartPoint[] {
  return asArray(value).map((item) => {
    const point = asRecord(item)
    return { label: text(point.label), value: toNumber(point.value) }
  })
}

function nullableNumber(value: unknown): number | null {
  if (value == null) return null
  const number = toNumber(value)
  return Number.isFinite(number) ? number : null
}

function text(value: unknown): string {
  return typeof value === "string" ? value : ""
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
