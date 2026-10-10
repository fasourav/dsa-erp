import { classifyOperational, isMaterialWork } from "@/lib/dashboard-metrics"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { sumAmounts } from "@/lib/payment-status"
import { dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export type ProjectDetail = {
  id: string
  name: string
  clientName: string
  clientId: string
  location: string
  startedOn: string
  completedOn: string
  projectType: string
  status: string
  currentPhase: string
  totalValue: number
  details: string
}

export type ProjectFinancial = {
  totalValue: number
  totalPaid: number
  totalPendingDue: number
  expenseTotal: number
  expenseDue: number
  grossProfit: number
  backlogAmount: number
}

export type LinkedPO = {
  id: string
  vendorName: string
  issuedOn: string
  totalValue: number
  workType: string
}

export type LinkedInvoice = {
  id: string
  issuedOn: string
  amount: number
  status: string
  description: string
}

export type BacklogEntry = {
  projectId: string
  projectName: string
  projectValue: number
  backlogAmount: number
  clientName: string
}

export type ProjectMonthPoint = {
  label: string
  revenue: number
  totalExpense: number
  netProfit: number
}

export type RecentClientPayment = {
  id: string
  paidOn: string
  amount: number
  method: string
}

export type OpenInvoice = LinkedInvoice & {
  paid: number
  balance: number
}

export type OpenPurchaseOrder = LinkedPO & {
  paid: number
  pending: number
}

export type ProjectOverview = {
  projectValue: number
  totalInvoiced: number
  unbilled: number
  received: number
  receivable: number
  contractBalance: number
  poCommitments: number
  paidToVendors: number
  payable: number
  operational: number
  collectedTax: number
  taxPaid: number
  grossProfit: number
  profitAfterTax: number
  months: ProjectMonthPoint[]
  breakdown: { key: string; amount: number }[]
  recentPayments: RecentClientPayment[]
  openInvoices: OpenInvoice[]
  openPurchaseOrders: OpenPurchaseOrder[]
}

export async function getProjectDetail(projectId: string): Promise<{
  project: ProjectDetail | null
  overview: ProjectOverview | null
  backlog: BacklogEntry | null
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const { data: projData, error: projErr } = await supabase
      .from("projects")
      .select(
        "id, name, client_id, location, started_on, completed_on, project_type, status, current_phase, total_value, details",
      )
      .eq("id", projectId)
      .limit(1)

    if (projErr) throw projErr
    if (!projData || projData.length === 0) {
      return {
        project: null,
        overview: null,
        backlog: null,
        error: "Project not found.",
      }
    }

    const p = projData[0]

    const { data: clientData } = await supabase
      .from("clients")
      .select("person_name, company_name")
      .eq("id", p.client_id)
      .limit(1)

    const client = clientData?.[0]
    const clientName =
      client?.company_name?.trim() || client?.person_name?.trim() || ""

    const project: ProjectDetail = {
      id: p.id,
      name: p.name,
      clientName,
      clientId: p.client_id,
      location: p.location ?? "",
      startedOn: p.started_on,
      completedOn: p.completed_on ?? "",
      projectType: p.project_type ?? "",
      status: p.status,
      currentPhase: p.current_phase ?? "",
      totalValue: p.total_value,
      details: p.details ?? "",
    }

    const [poRows, invRows, blRows, operationalRows, taxRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("vendor_purchase_orders")
            .select("id, vendor_id, issued_on, total_value, work_type")
            .eq("project_id", projectId)
            .order("issued_on", { ascending: false })
            .range(from, to),
        "PO list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("client_invoices")
            .select("id, issued_on, amount, status, description")
            .eq("project_id", projectId)
            .order("issued_on", { ascending: false })
            .range(from, to),
        "Invoice list is larger than expected.",
      ),
      supabase
        .from("project_backlogs")
        .select("*")
        .eq("project_id", projectId)
        .limit(1),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("operational_expenses")
            .select("amount, expense_date, category")
            .eq("project_id", projectId)
            .order("id", { ascending: true })
            .range(from, to),
        "Operational expense list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("vat_tax_payments")
            .select("amount, paid_on, collected_on_invoice, client_invoice_id")
            .eq("project_id", projectId)
            .order("id", { ascending: true })
            .range(from, to),
        "VAT tax list is larger than expected.",
      ),
    ])

    const vendorIds = [...new Set(poRows.map((po) => po.vendor_id))]
    const vendorMap = new Map<string, string>()
    if (vendorIds.length > 0) {
      const { data: vendorData } = await supabase
        .from("vendors")
        .select("id, person_name, company_name")
        .in("id", vendorIds)

      for (const v of vendorData ?? []) {
        vendorMap.set(
          v.id,
          v.company_name?.trim() || v.person_name?.trim() || "",
        )
      }
    }

    const purchaseOrders: LinkedPO[] = poRows.map((po) => ({
      id: po.id,
      vendorName: vendorMap.get(po.vendor_id) ?? "",
      issuedOn: dateInputValue(po.issued_on),
      totalValue: toNumber(po.total_value),
      workType: po.work_type ?? "",
    }))

    const invoices: LinkedInvoice[] = invRows.map((inv) => ({
      id: inv.id,
      issuedOn: dateInputValue(inv.issued_on),
      amount: toNumber(inv.amount),
      status: inv.status,
      description: inv.description ?? "",
    }))

    const invoiceIds = invoices
      .filter((invoice) => invoice.status !== "void")
      .map((invoice) => invoice.id)
    const poIds = purchaseOrders.map((po) => po.id)

    const [paymentRows, balanceRows, vendorInvoiceRows] = await Promise.all([
      invoiceIds.length === 0
        ? Promise.resolve([])
        : fetchAllPages(
            (from, to) =>
              supabase
                .from("client_payments")
                .select("id, client_invoice_id, paid_on, amount, method")
                .in("client_invoice_id", invoiceIds)
                .order("id", { ascending: true })
                .range(from, to),
            "Client payment list is larger than expected.",
          ),
      poIds.length === 0
        ? Promise.resolve([])
        : fetchAllPages(
            (from, to) =>
              supabase
                .from("vendor_po_balances")
                .select("purchase_order_id, total_paid, total_pending")
                .in("purchase_order_id", poIds)
                .order("purchase_order_id", { ascending: true })
                .range(from, to),
            "Purchase order balance list is larger than expected.",
          ),
      poIds.length === 0
        ? Promise.resolve([])
        : fetchAllPages(
            (from, to) =>
              supabase
                .from("vendor_invoices")
                .select("id, purchase_order_id")
                .in("purchase_order_id", poIds)
                .order("id", { ascending: true })
                .range(from, to),
            "Vendor invoice list is larger than expected.",
          ),
    ])

    const vendorInvoiceIds = vendorInvoiceRows.map((row) => row.id)
    const vendorPaymentRows =
      vendorInvoiceIds.length === 0
        ? []
        : await fetchAllPages(
            (from, to) =>
              supabase
                .from("vendor_payments")
                .select("amount, paid_on, vendor_invoice_id")
                .in("vendor_invoice_id", vendorInvoiceIds)
                .order("id", { ascending: true })
                .range(from, to),
            "Vendor payment list is larger than expected.",
          )

    const bl = blRows.data?.[0]
    const backlog: BacklogEntry | null = bl
      ? {
          projectId: bl.project_id ?? "",
          projectName: bl.project_name ?? "",
          projectValue: bl.project_value ?? 0,
          backlogAmount: bl.backlog_amount ?? 0,
          clientName: bl.client_name ?? "",
        }
      : null

    const overview = buildOverview({
      projectValue: project.totalValue,
      invoices,
      purchaseOrders,
      payments: paymentRows,
      balances: balanceRows,
      vendorInvoices: vendorInvoiceRows,
      vendorPayments: vendorPaymentRows,
      operational: operationalRows,
      taxes: taxRows,
    })

    return { project, overview, backlog, error: null }
  } catch {
    return {
      project: null,
      overview: null,
      backlog: null,
      error: "Could not load project details.",
    }
  }
}

function buildOverview(input: {
  projectValue: number
  invoices: LinkedInvoice[]
  purchaseOrders: LinkedPO[]
  payments: {
    id: string
    client_invoice_id: string
    paid_on: string
    amount: number
    method: string | null
  }[]
  balances: {
    purchase_order_id: string | null
    total_paid: number | null
    total_pending: number | null
  }[]
  vendorInvoices: { id: string; purchase_order_id: string }[]
  vendorPayments: {
    amount: number
    paid_on: string
    vendor_invoice_id: string
  }[]
  operational: { amount: number; expense_date: string; category: string }[]
  taxes: {
    amount: number
    paid_on: string
    collected_on_invoice: boolean
    client_invoice_id: string | null
  }[]
}): ProjectOverview {
  const activeInvoiceIds = new Set(
    input.invoices
      .filter((invoice) => invoice.status !== "void")
      .map((invoice) => invoice.id),
  )
  const payments = input.payments.filter((payment) =>
    activeInvoiceIds.has(payment.client_invoice_id),
  )
  let collectedTax = 0
  let taxPaid = 0

  for (const tax of input.taxes) {
    const amount = toNumber(tax.amount)
    if (tax.collected_on_invoice) {
      if (!tax.client_invoice_id || !activeInvoiceIds.has(tax.client_invoice_id)) {
        continue
      }
      collectedTax = sumAmounts([collectedTax, amount])
      continue
    }
    taxPaid = sumAmounts([taxPaid, amount])
  }

  const received = sumAmounts(payments.map((payment) => toNumber(payment.amount)))
  const totalInvoiced = sumAmounts(
    input.invoices
      .filter((invoice) => invoice.status !== "void")
      .map((invoice) => invoice.amount),
  )
  const balanceByPo = new Map<string, { paid: number; pending: number }>()
  for (const balance of input.balances) {
    if (!balance.purchase_order_id) continue
    balanceByPo.set(balance.purchase_order_id, {
      paid: toNumber(balance.total_paid),
      pending: toNumber(balance.total_pending),
    })
  }

  let paidToVendors = 0
  let payable = 0
  for (const po of input.purchaseOrders) {
    const balance = balanceByPo.get(po.id)
    paidToVendors = sumAmounts([paidToVendors, balance?.paid ?? 0])
    payable = sumAmounts([payable, balance?.pending ?? po.totalValue])
  }

  const operational = sumAmounts(
    input.operational.map((row) => toNumber(row.amount)),
  )
  const poCommitments = sumAmounts(
    input.purchaseOrders.map((po) => po.totalValue),
  )
  const grossProfit = sumAmounts([received, -paidToVendors, -operational])
  const buckets = new Map<string, number>()
  const months = new Map<string, { revenue: number; expense: number }>()

  function addBucket(key: string, amount: number) {
    if (amount === 0) return
    buckets.set(key, sumAmounts([buckets.get(key) ?? 0, amount]))
  }

  function addMonth(value: string, field: "revenue" | "expense", amount: number) {
    const key = monthKey(value)
    if (!key || amount === 0) return
    const current = months.get(key) ?? { revenue: 0, expense: 0 }
    current[field] = sumAmounts([current[field], amount])
    months.set(key, current)
  }

  const workByPo = new Map(
    input.purchaseOrders.map((po) => [po.id, po.workType]),
  )
  const poByVendorInvoice = new Map(
    input.vendorInvoices.map((row) => [row.id, row.purchase_order_id]),
  )

  for (const payment of input.vendorPayments) {
    const amount = toNumber(payment.amount)
    const workType =
      workByPo.get(poByVendorInvoice.get(payment.vendor_invoice_id) ?? "") ?? ""
    addBucket(isMaterialWork(workType) ? "material" : "subcontractor", amount)
    addMonth(payment.paid_on, "expense", amount)
  }

  for (const expense of input.operational) {
    const amount = toNumber(expense.amount)
    addBucket(classifyOperational(expense.category ?? ""), amount)
    addMonth(expense.expense_date, "expense", amount)
  }

  for (const tax of input.taxes) {
    if (tax.collected_on_invoice) continue
    const amount = toNumber(tax.amount)
    addBucket("tax", amount)
    addMonth(tax.paid_on, "expense", amount)
  }

  for (const payment of payments) {
    addMonth(payment.paid_on, "revenue", toNumber(payment.amount))
  }

  const settledByInvoice = new Map<string, number>()
  for (const payment of payments) {
    const invoiceId = payment.client_invoice_id
    settledByInvoice.set(
      invoiceId,
      sumAmounts([
        settledByInvoice.get(invoiceId) ?? 0,
        toNumber(payment.amount),
      ]),
    )
  }

  return {
    projectValue: input.projectValue,
    totalInvoiced,
    unbilled: remaining(input.projectValue, totalInvoiced),
    received,
    receivable: remaining(totalInvoiced, received),
    contractBalance: remaining(input.projectValue, received),
    poCommitments,
    paidToVendors,
    payable,
    operational,
    collectedTax,
    taxPaid,
    grossProfit,
    profitAfterTax: sumAmounts([grossProfit, -taxPaid]),
    months: [...months.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, point]) => ({
        label: monthLabel(key),
        revenue: point.revenue,
        totalExpense: point.expense,
        netProfit: sumAmounts([point.revenue, -point.expense]),
      })),
    breakdown: [...buckets.entries()].map(([key, amount]) => ({ key, amount })),
    recentPayments: payments
      .map((payment) => ({
        id: payment.id,
        paidOn: dateInputValue(payment.paid_on),
        amount: toNumber(payment.amount),
        method: payment.method?.trim() ?? "",
      }))
      .sort(
        (left, right) =>
          right.paidOn.localeCompare(left.paidOn) ||
          right.id.localeCompare(left.id),
      )
      .slice(0, 5),
    openInvoices: input.invoices.flatMap((invoice) => {
      if (invoice.status === "void") return []
      const paid = settledByInvoice.get(invoice.id) ?? 0
      const balance = remaining(invoice.amount, paid)
      if (balance <= 0) return []
      return [{ ...invoice, paid, balance }]
    }),
    openPurchaseOrders: input.purchaseOrders.flatMap((po) => {
      const balance = balanceByPo.get(po.id)
      const paid = balance?.paid ?? 0
      const pending = balance?.pending ?? po.totalValue
      if (pending <= 0) return []
      return [{ ...po, paid, pending }]
    }),
  }
}

function remaining(total: number, used: number): number {
  const cents = Math.round(total * 100) - Math.round(used * 100)
  return cents > 0 ? cents / 100 : 0
}

function monthKey(value: string): string | null {
  const date = dateInputValue(value)
  const key = date.slice(0, 7)
  return /^\d{4}-\d{2}$/.test(key) ? key : null
}

function monthLabel(key: string): string {
  const year = Number(key.slice(0, 4))
  const month = Number(key.slice(5, 7))
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1))
}
