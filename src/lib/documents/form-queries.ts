import { formatIsoDate } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"
import { isUuid } from "@/lib/ids"
import type { DocumentListItem } from "@/lib/documents/queries"
import {
  blankBody,
  type FormBody,
  type FormDraft,
  type FormKind,
} from "@/lib/documents/form-model"
import type { Json } from "@/types/database.types"

const unavailable =
  "Document storage is not available until the Set C documents migration is applied."

function missingTable(error: { message?: string; code?: string } | null): boolean {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`
  return /42P01|PGRST205|schema cache|does not exist|Could not find the table/i.test(text)
}

function asBody(value: Json | null): FormBody {
  const base = blankBody()
  if (!value || typeof value !== "object" || Array.isArray(value)) return base
  const record = value as Record<string, Json | undefined>
  const text = (key: keyof FormBody) => (typeof record[key] === "string" ? (record[key] as string) : base[key])
  return {
    ...base,
    subtitle: text("subtitle") as string,
    preparedBy: text("preparedBy") as string,
    checkedBy: text("checkedBy") as string,
    authorizedBy: text("authorizedBy") as string,
    partyName: text("partyName") as string,
    partyDetail: text("partyDetail") as string,
    companyName: text("companyName") as string,
    projectName: text("projectName") as string,
    notes: text("notes") as string,
    subject: text("subject") as string,
    paragraphs: text("paragraphs") as string,
    cc: text("cc") as string,
    letterKind: record.letterKind === "notice" ? "notice" : "letter",
    audience: text("audience") as string,
    clientWoNo: text("clientWoNo") as string,
    dispatchedFrom: text("dispatchedFrom") as string,
    vehicleNo: text("vehicleNo") as string,
    driverName: text("driverName") as string,
    packages: text("packages") as string,
    workOrderNo: text("workOrderNo") as string,
    site: text("site") as string,
    startDate: text("startDate") as string,
    completionDate: text("completionDate") as string,
    intro: text("intro") as string,
    scope: text("scope") as string,
    defect: text("defect") as string,
    designation: text("designation") as string,
    department: text("department") as string,
    joinedOn: text("joinedOn") as string,
    periodLabel: text("periodLabel") as string,
    workingDays: text("workingDays") as string,
    attendance: text("attendance") as string,
    payMode: text("payMode") as string,
    accountNo: text("accountNo") as string,
    againstRef: text("againstRef") as string,
    billNo: text("billNo") as string,
    accountHead: text("accountHead") as string,
    narration: text("narration") as string,
    paymentMode: text("paymentMode") as string,
    challanLines: Array.isArray(record.challanLines) ? (record.challanLines as FormBody["challanLines"]) : base.challanLines,
    inspections: Array.isArray(record.inspections) ? (record.inspections as FormBody["inspections"]) : base.inspections,
    earnings: Array.isArray(record.earnings) ? (record.earnings as FormBody["earnings"]) : base.earnings,
    deductions: Array.isArray(record.deductions) ? (record.deductions as FormBody["deductions"]) : base.deductions,
    duty: Array.isArray(record.duty) ? (record.duty as FormBody["duty"]) : base.duty,
    noticeRows: Array.isArray(record.noticeRows) ? (record.noticeRows as FormBody["noticeRows"]) : base.noticeRows,
  }
}

function rowToDraft(row: {
  id: string
  kind: string
  document_no: string
  verify_token: string
  issued_on: string
  project_id: string | null
  client_id: string | null
  vendor_id: string | null
  purchase_order_id: string | null
  vendor_payment_id: string | null
  operational_expense_id: string | null
  payroll_line_id: string | null
  employee_id: string | null
  total: number
  body: Json
}): FormDraft {
  const body = asBody(row.body)
  return {
    id: row.id,
    kind: row.kind as FormKind,
    documentNo: row.document_no,
    verifyToken: row.verify_token,
    issuedOn: row.issued_on.slice(0, 10),
    projectId: row.project_id ?? "",
    clientId: row.client_id ?? "",
    vendorId: row.vendor_id ?? "",
    purchaseOrderId: row.purchase_order_id ?? "",
    vendorPaymentId: row.vendor_payment_id ?? "",
    operationalExpenseId: row.operational_expense_id ?? "",
    payrollLineId: row.payroll_line_id ?? "",
    employeeId: row.employee_id ?? "",
    lockedNet: Number(row.total) || 0,
    lockedGross: Number(row.total) || 0,
    lockedDeductions: 0,
    statusNote: "",
    employeeCode: "",
    body,
  }
}

export async function listFormDocuments(kind: FormKind): Promise<{
  items: DocumentListItem[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("form_documents")
    .select("id, document_no, issued_on, body, total")
    .eq("kind", kind)
    .is("deleted_at", null)
    .order("issued_on", { ascending: false })
  if (error) return { items: [], error: missingTable(error) ? unavailable : "Could not load documents." }
  return {
    items: (data ?? []).map((row) => {
      const body = asBody(row.body)
      return {
        id: row.id,
        title: body.partyName || body.projectName || body.subject || "Document",
        detail: formatIsoDate(row.issued_on.slice(0, 10)),
        documentNo: row.document_no,
      }
    }),
    error: null,
  }
}

export async function loadFormDraft(
  kind: FormKind,
  id: string | null,
  query: Record<string, string | undefined>,
): Promise<{ draft: FormDraft | null; error: string | null }> {
  const { todayIsoDate } = await import("@/lib/project-validation")
  const supabase = await createClient()
  if (id) {
    if (!isUuid(id)) return { draft: null, error: "That document could not be found." }
    const { data, error } = await supabase
      .from("form_documents")
      .select("*")
      .eq("id", id)
      .eq("kind", kind)
      .is("deleted_at", null)
      .maybeSingle()
    if (error) return { draft: null, error: missingTable(error) ? unavailable : "Could not load this document." }
    if (!data) return { draft: null, error: "That document could not be found." }
    const draft = rowToDraft(data)
    if (kind === "salary_slip" && draft.payrollLineId) {
      const line = await supabase
        .from("payroll_lines")
        .select("basic_salary, allowance, bonus, deductions, net_salary")
        .eq("id", draft.payrollLineId)
        .maybeSingle()
      if (line.data) {
        const gross = Number(line.data.basic_salary) + Number(line.data.allowance) + Number(line.data.bonus)
        draft.lockedGross = gross
        draft.lockedDeductions = Number(line.data.deductions) || 0
        draft.lockedNet = line.data.net_salary == null ? gross - draft.lockedDeductions : Number(line.data.net_salary)
      }
    }
    if (kind === "payment_voucher") {
      draft.lockedNet = await voucherAmount(supabase, draft)
      if (draft.purchaseOrderId) {
        draft.statusNote = await workOrderStatus(supabase, draft.purchaseOrderId, draft.lockedNet, draft.vendorPaymentId)
      }
    }
    if (kind === "salary_slip" && draft.employeeId) {
      const employee = await supabase.from("employees").select("employee_code").eq("id", draft.employeeId).maybeSingle()
      draft.employeeCode = employee.data?.employee_code?.trim() ?? ""
    }
    return { draft, error: null }
  }

  const draft: FormDraft = {
    id: null,
    kind,
    documentNo: "",
    verifyToken: "",
    issuedOn: todayIsoDate(),
    projectId: query.project && isUuid(query.project) ? query.project : "",
    clientId: query.client && isUuid(query.client) ? query.client : "",
    vendorId: "",
    purchaseOrderId: query.po && isUuid(query.po) ? query.po : "",
    vendorPaymentId: query.payment && isUuid(query.payment) ? query.payment : "",
    operationalExpenseId: query.expense && isUuid(query.expense) ? query.expense : "",
    payrollLineId: query.line && isUuid(query.line) ? query.line : "",
    employeeId: "",
    lockedNet: 0,
    lockedGross: 0,
    lockedDeductions: 0,
    statusNote: "",
    employeeCode: "",
    body: blankBody(),
  }

  if (kind === "delivery_challan" && draft.purchaseOrderId) {
    await fillFromPurchaseOrder(supabase, draft)
  } else if (kind === "delivery_challan" && draft.projectId) {
    await fillFromProject(supabase, draft)
  } else if (kind === "payment_voucher" && draft.vendorPaymentId) {
    await fillFromVendorPayment(supabase, draft)
  } else if (kind === "payment_voucher" && draft.operationalExpenseId) {
    await fillFromExpense(supabase, draft)
  } else if (kind === "completion" && draft.projectId) {
    await fillFromProject(supabase, draft)
    const order = await supabase
      .from("work_orders")
      .select("document_no")
      .eq("project_id", draft.projectId)
      .is("deleted_at", null)
      .order("issued_on", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (order.data?.document_no) draft.body.workOrderNo = order.data.document_no
  } else if (kind === "salary_slip" && draft.payrollLineId) {
    const filled = await fillFromPayroll(supabase, draft)
    if (filled) return { draft: null, error: filled }
  } else if (kind === "letter") {
    if (draft.clientId) await fillClient(supabase, draft)
    if (draft.projectId) await fillFromProject(supabase, draft)
  }

  if (kind === "delivery_challan" && !draft.purchaseOrderId && !draft.projectId) {
    return { draft: null, error: "Open a delivery challan from a purchase order or a project." }
  }
  if (kind === "payment_voucher" && !draft.vendorPaymentId && !draft.operationalExpenseId) {
    return { draft: null, error: "Open a payment voucher from a vendor payment or an operational expense." }
  }
  if (kind === "completion" && !draft.projectId) {
    return { draft: null, error: "Open a completion certificate from a project." }
  }
  if (kind === "salary_slip" && !draft.payrollLineId) {
    return { draft: null, error: "Open a salary slip from a payroll line." }
  }
  return { draft, error: null }
}

type Client = Awaited<ReturnType<typeof createClient>>

async function voucherAmount(supabase: Client, draft: FormDraft): Promise<number> {
  if (draft.vendorPaymentId) {
    const payment = await supabase.from("vendor_payments").select("amount").eq("id", draft.vendorPaymentId).maybeSingle()
    if (payment.data) return Number(payment.data.amount) || 0
  }
  if (draft.operationalExpenseId) {
    const expense = await supabase
      .from("operational_expenses")
      .select("amount")
      .eq("id", draft.operationalExpenseId)
      .maybeSingle()
    if (expense.data) return Number(expense.data.amount) || 0
  }
  return draft.lockedNet
}

async function fillFromPurchaseOrder(supabase: Client, draft: FormDraft) {
  const order = await supabase
    .from("vendor_purchase_orders")
    .select("id, vendor_id, project_id, issued_on, work_type, notes")
    .eq("id", draft.purchaseOrderId)
    .maybeSingle()
  if (!order.data) return
  draft.vendorId = order.data.vendor_id
  draft.projectId = order.data.project_id ?? ""
  draft.issuedOn = order.data.issued_on.slice(0, 10)
  draft.body.subject = order.data.work_type?.trim() || ""
  draft.body.notes = order.data.notes?.trim() || ""
  draft.body.challanLines = [
    {
      item: order.data.work_type?.trim() || "Goods",
      specification: "",
      unit: "Lot",
      ordered: "1",
      delivered: "1",
      remarks: "",
    },
  ]
  await fillVendor(supabase, draft, order.data.vendor_id)
  if (order.data.project_id) await fillFromProject(supabase, draft)
}

async function fillFromProject(supabase: Client, draft: FormDraft) {
  const project = await supabase
    .from("projects")
    .select("id, name, client_id, location")
    .eq("id", draft.projectId)
    .maybeSingle()
  if (!project.data) return
  draft.body.projectName = project.data.name
  draft.body.site = draft.body.site || project.data.location || ""
  if (project.data.client_id) {
    draft.clientId = draft.clientId || project.data.client_id
    await fillClient(supabase, draft)
  }
}

async function fillClient(supabase: Client, draft: FormDraft) {
  const client = await supabase
    .from("clients")
    .select("company_name, person_name, address, phone, email")
    .eq("id", draft.clientId)
    .maybeSingle()
  if (!client.data) return
  const name = client.data.company_name?.trim() || client.data.person_name?.trim() || ""
  if (!draft.body.partyName) draft.body.partyName = name
  const detail = [client.data.person_name, client.data.address, [client.data.phone, client.data.email].filter(Boolean).join(" · ")]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
  if (!draft.body.partyDetail) draft.body.partyDetail = detail.join("\n")
}

async function fillVendor(supabase: Client, draft: FormDraft, vendorId: string) {
  const vendor = await supabase
    .from("vendors")
    .select("company_name, person_name, address, phone")
    .eq("id", vendorId)
    .maybeSingle()
  if (!vendor.data) return
  draft.body.partyName = vendor.data.company_name?.trim() || vendor.data.person_name?.trim() || ""
  draft.body.partyDetail = [vendor.data.person_name, vendor.data.address, vendor.data.phone]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
}

function paymentNotAfter(
  row: { id: string; paid_on: string; created_at: string },
  current: { id: string; paid_on: string; created_at: string },
): boolean {
  const day = row.paid_on.slice(0, 10)
  const currentDay = current.paid_on.slice(0, 10)
  if (day < currentDay) return true
  if (day > currentDay) return false
  const rowTime = Date.parse(row.created_at)
  const currentTime = Date.parse(current.created_at)
  if (rowTime < currentTime) return true
  if (rowTime > currentTime) return false
  return row.id < current.id
}

async function workOrderStatus(
  supabase: Client,
  purchaseOrderId: string,
  thisBill: number,
  thisPaymentId: string,
): Promise<string> {
  const order = await supabase.from("vendor_purchase_orders").select("total_value").eq("id", purchaseOrderId).maybeSingle()
  const total = Number(order.data?.total_value)
  if (!Number.isFinite(total)) return ""
  const current = thisPaymentId
    ? await supabase.from("vendor_payments").select("id, paid_on, created_at").eq("id", thisPaymentId).maybeSingle()
    : { data: null }
  const invoices = await supabase.from("vendor_invoices").select("id").eq("purchase_order_id", purchaseOrderId)
  const ids = (invoices.data ?? []).map((row) => row.id)
  const payments = ids.length
    ? await supabase.from("vendor_payments").select("id, amount, paid_on, created_at").in("vendor_invoice_id", ids)
    : { data: [] as Array<{ id: string; amount: number; paid_on: string; created_at: string }> }
  const anchor = current.data
  const paidBefore = (payments.data ?? [])
    .filter((row) => (anchor ? paymentNotAfter(row, anchor) : true))
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
  const balance = Math.round((total - paidBefore - thisBill) * 100) / 100
  const money = (value: number) => value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `PO value ৳${money(total)} · Paid before this bill ৳${money(paidBefore)} · This bill ৳${money(thisBill)} · Balance ৳${money(balance)}`
}

async function fillFromVendorPayment(supabase: Client, draft: FormDraft) {
  const payment = await supabase
    .from("vendor_payments")
    .select("id, amount, paid_on, method, reference, notes, vendor_invoice_id")
    .eq("id", draft.vendorPaymentId)
    .maybeSingle()
  if (!payment.data) return
  draft.lockedNet = Number(payment.data.amount) || 0
  draft.issuedOn = payment.data.paid_on.slice(0, 10)
  draft.body.paymentMode = [payment.data.method, payment.data.reference].filter(Boolean).join(" · ")
  draft.body.narration = payment.data.notes?.trim() || ""
  draft.body.subject = "Vendor payment"
  const invoice = await supabase
    .from("vendor_invoices")
    .select("purchase_order_id, description")
    .eq("id", payment.data.vendor_invoice_id)
    .maybeSingle()
  if (!invoice.data) return
  draft.purchaseOrderId = invoice.data.purchase_order_id
  draft.body.billNo = invoice.data.description?.trim() || ""
  await fillFromPurchaseOrder(supabase, draft)
  draft.body.subject = invoice.data.description?.trim() || draft.body.subject
  draft.statusNote = await workOrderStatus(supabase, invoice.data.purchase_order_id, draft.lockedNet, draft.vendorPaymentId)
}

async function fillFromExpense(supabase: Client, draft: FormDraft) {
  const expense = await supabase
    .from("operational_expenses")
    .select("id, amount, expense_date, category, notes, payment_method, vendor_id, project_id")
    .eq("id", draft.operationalExpenseId)
    .maybeSingle()
  if (!expense.data) return
  draft.lockedNet = Number(expense.data.amount) || 0
  draft.issuedOn = expense.data.expense_date.slice(0, 10)
  draft.projectId = expense.data.project_id ?? ""
  draft.vendorId = expense.data.vendor_id ?? ""
  draft.body.accountHead = expense.data.category
  draft.body.subject = expense.data.category
  draft.body.narration = expense.data.notes?.trim() || ""
  draft.body.paymentMode = expense.data.payment_method?.trim() || ""
  draft.body.projectName = "Operational"
  if (expense.data.vendor_id) await fillVendor(supabase, draft, expense.data.vendor_id)
  else draft.body.partyName = expense.data.category
  if (expense.data.project_id) await fillFromProject(supabase, draft)
}

async function fillFromPayroll(supabase: Client, draft: FormDraft): Promise<string | null> {
  const line = await supabase
    .from("payroll_lines")
    .select("id, employee_id, basic_salary, allowance, bonus, deductions, net_salary, payroll_run_id")
    .eq("id", draft.payrollLineId)
    .maybeSingle()
  if (!line.data) return "That payroll line could not be found."
  const run = await supabase
    .from("payroll_runs")
    .select("period_month, period_year, paid_on, payment_method")
    .eq("id", line.data.payroll_run_id)
    .maybeSingle()
  const employee = await supabase
    .from("employees")
    .select("full_name, designation, joining_date, employee_code")
    .eq("id", line.data.employee_id)
    .maybeSingle()
  const gross = Number(line.data.basic_salary) + Number(line.data.allowance) + Number(line.data.bonus)
  const deductions = Number(line.data.deductions) || 0
  draft.employeeId = line.data.employee_id
  draft.lockedGross = gross
  draft.lockedDeductions = deductions
  draft.lockedNet = line.data.net_salary == null ? gross - deductions : Number(line.data.net_salary)
  draft.issuedOn = run.data?.paid_on?.slice(0, 10) || draft.issuedOn
  const month = run.data ? `${run.data.period_year}-${String(run.data.period_month).padStart(2, "0")}` : ""
  draft.body.periodLabel = month
  draft.employeeCode = employee.data?.employee_code?.trim() ?? ""
  draft.body.partyName = employee.data?.full_name ?? ""
  draft.body.designation = employee.data?.designation ?? ""
  draft.body.joinedOn = employee.data?.joining_date?.slice(0, 10) ?? ""
  draft.body.payMode = run.data?.payment_method ?? ""
  draft.body.earnings = [
    { label: "Basic Salary", amount: String(line.data.basic_salary) },
    { label: "Allowance", amount: String(line.data.allowance) },
    { label: "Bonus", amount: String(line.data.bonus) },
  ]
  draft.body.deductions = [{ label: "Deductions", amount: String(deductions) }]
  return null
}
