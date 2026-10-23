"use server"

import { randomBytes } from "node:crypto"

import { revalidatePath } from "next/cache"

import { allows, type ModuleKey } from "@/lib/access"
import type { FormBody, FormKind } from "@/lib/documents/form-model"
import { slugForKind } from "@/lib/documents/form-model"
import {
  certificateNumber,
  challanNumber,
  collisionNumber,
  letterNumber,
  salaryNumber,
  voucherNumber,
} from "@/lib/documents/numbers"
import { isUuid } from "@/lib/ids"
import { getAccess } from "@/lib/permissions"
import { isIsoDate } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database.types"

export type FormSaveResult = { error: string | null; id?: string; documentNo?: string; verifyToken?: string }

function modulesFor(kind: FormKind): ModuleKey[] {
  if (kind === "delivery_challan") return ["purchase_orders", "projects"]
  if (kind === "payment_voucher") return ["vendor_payments", "expenses"]
  if (kind === "completion") return ["projects"]
  if (kind === "salary_slip") return ["payroll"]
  return ["projects", "clients"]
}

async function guard(kind: FormKind, exists: boolean): Promise<string | null> {
  const access = await getAccess()
  if (!access || access.status === "deactivated") return "Your session has expired. Sign in again."
  const action = exists ? "edit" : "add"
  if (!modulesFor(kind).some((module) => allows(access, module, action))) {
    return "You do not have permission to do that."
  }
  return null
}

export async function saveFormDocument(input: {
  id: string | null
  kind: FormKind
  issuedOn: string
  projectId: string
  clientId: string
  vendorId: string
  purchaseOrderId: string
  vendorPaymentId: string
  operationalExpenseId: string
  payrollLineId: string
  employeeId: string
  body: FormBody
}): Promise<FormSaveResult> {
  if (!isIsoDate(input.issuedOn)) return { error: "Enter a date." }
  const denied = await guard(input.kind, Boolean(input.id))
  if (denied) return { error: denied }
  if (input.id && !isUuid(input.id)) return { error: "That document could not be found." }

  const supabase = await createClient()
  const linked = await linkedFacts(supabase, input)
  if (linked.error) return { error: linked.error }
  const base = numberFor(input.kind, input.issuedOn, linked.project, linked.party, linked.notice, linked.period, linked.employeeCode)
  if (!base) return { error: linked.kindError || "Could not build a document number from the linked record." }
  let documentNo = ""
  if (input.id) {
    const existing = await supabase.from("form_documents").select("document_no, verify_token").eq("id", input.id).maybeSingle()
    if (existing.error || !existing.data) return { error: "That document could not be found." }
    documentNo = existing.data.document_no
    const { error } = await supabase
      .from("form_documents")
      .update({
        issued_on: input.issuedOn,
        total: linked.total,
        project_id: input.projectId || null,
        client_id: input.clientId || null,
        vendor_id: input.vendorId || null,
        purchase_order_id: input.purchaseOrderId || null,
        vendor_payment_id: input.vendorPaymentId || null,
        operational_expense_id: input.operationalExpenseId || null,
        payroll_line_id: input.payrollLineId || null,
        employee_id: input.employeeId || null,
        body: input.body as unknown as Json,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
    if (error) return { error: "Could not save this document." }
    revalidatePath(`/documents/${slugForKind(input.kind)}`)
    revalidatePath(`/documents/${slugForKind(input.kind)}/${input.id}`)
    return { error: null, id: input.id, documentNo, verifyToken: existing.data.verify_token }
  }

  for (let attempt = 1; attempt <= 8; attempt += 1) {
    documentNo = collisionNumber(base, attempt)
    const verifyToken = randomBytes(32).toString("hex")
    const { data, error } = await supabase
      .from("form_documents")
      .insert({
        kind: input.kind,
        document_no: documentNo,
        issued_on: input.issuedOn,
        total: linked.total,
        verify_token: verifyToken,
        project_id: input.projectId || null,
        client_id: input.clientId || null,
        vendor_id: input.vendorId || null,
        purchase_order_id: input.purchaseOrderId || null,
        vendor_payment_id: input.vendorPaymentId || null,
        operational_expense_id: input.operationalExpenseId || null,
        payroll_line_id: input.payrollLineId || null,
        employee_id: input.employeeId || null,
        body: input.body as unknown as Json,
      })
      .select("id")
      .maybeSingle()
    if (!error && data) {
      revalidatePath(`/documents/${slugForKind(input.kind)}`)
      return { error: null, id: data.id, documentNo, verifyToken }
    }
    if (error?.code !== "23505") return { error: "Could not save this document." }
  }
  return { error: "That document number is already in use." }
}

function numberFor(
  kind: FormKind,
  issuedOn: string,
  project: string,
  party: string,
  notice: boolean,
  period: { year: number; month: number } | null,
  employeeCode: string,
): string | null {
  if (kind === "delivery_challan") return challanNumber(issuedOn, party, project)
  if (kind === "payment_voucher") return voucherNumber(issuedOn, party, project)
  if (kind === "completion") return certificateNumber(issuedOn, party, project)
  if (kind === "salary_slip") {
    if (!period || !employeeCode.trim()) return null
    return salaryNumber(period.year, period.month, employeeCode)
  }
  if (kind === "letter") return letterNumber(issuedOn, project, notice)
  return null
}

type LinkFacts = {
  error: string | null
  kindError: string
  total: number
  project: string
  party: string
  notice: boolean
  period: { year: number; month: number } | null
  employeeCode: string
}

async function linkedFacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    kind: FormKind
    projectId: string
    clientId: string
    vendorId: string
    purchaseOrderId: string
    vendorPaymentId: string
    operationalExpenseId: string
    payrollLineId: string
    employeeId: string
    body: FormBody
  },
): Promise<LinkFacts> {
  const empty = (error: string | null, extra: Partial<LinkFacts> = {}): LinkFacts => ({
    error,
    kindError: "",
    total: 0,
    project: "",
    party: "",
    notice: input.body.letterKind === "notice",
    period: null,
    employeeCode: "",
    ...extra,
  })
  const projectName = await lookupName(supabase, "projects", input.projectId, "name")
  const clientName = await partyName(supabase, "clients", input.clientId)
  const vendorName = await partyName(supabase, "vendors", input.vendorId)

  if (input.kind === "payment_voucher" && input.vendorPaymentId) {
    const payment = await supabase
      .from("vendor_payments")
      .select("amount, vendor_invoice_id")
      .eq("id", input.vendorPaymentId)
      .maybeSingle()
    if (!payment.data) return empty("That vendor payment could not be found.")
    const invoice = await supabase
      .from("vendor_invoices")
      .select("purchase_order_id")
      .eq("id", payment.data.vendor_invoice_id)
      .maybeSingle()
    const order = invoice.data
      ? await supabase
          .from("vendor_purchase_orders")
          .select("vendor_id, project_id")
          .eq("id", invoice.data.purchase_order_id)
          .maybeSingle()
      : { data: null }
    const vendor = order.data ? await partyName(supabase, "vendors", order.data.vendor_id) : vendorName
    const project = order.data?.project_id ? await lookupName(supabase, "projects", order.data.project_id, "name") : ""
    return empty(null, { total: Number(payment.data.amount) || 0, party: vendor, project })
  }
  if (input.kind === "payment_voucher" && input.operationalExpenseId) {
    const expense = await supabase
      .from("operational_expenses")
      .select("amount, vendor_id, project_id, category")
      .eq("id", input.operationalExpenseId)
      .maybeSingle()
    if (!expense.data) return empty("That expense could not be found.")
    const category = expense.data.category?.trim() ?? ""
    const payee = input.body.partyName.trim()
    const vendor = expense.data.vendor_id
      ? await partyName(supabase, "vendors", expense.data.vendor_id)
      : payee || category
    const project = expense.data.project_id ? await lookupName(supabase, "projects", expense.data.project_id, "name") : ""
    return empty(null, { total: Number(expense.data.amount) || 0, party: vendor, project })
  }
  if (input.kind === "salary_slip") {
    if (!input.payrollLineId) return empty("Open a salary slip from a payroll line.")
    const line = await supabase
      .from("payroll_lines")
      .select("basic_salary, allowance, bonus, deductions, net_salary, payroll_run_id, employee_id")
      .eq("id", input.payrollLineId)
      .maybeSingle()
    if (!line.data) return empty("That payroll line could not be found.")
    if (input.employeeId && input.employeeId !== line.data.employee_id) {
      return empty("The employee does not match this payroll line.")
    }
    const employee = await supabase.from("employees").select("employee_code").eq("id", line.data.employee_id).maybeSingle()
    const code = employee.data?.employee_code?.trim() ?? ""
    if (!code) return empty("Add an employee code before saving this salary slip.", { kindError: "This employee has no code." })
    const run = await supabase
      .from("payroll_runs")
      .select("period_year, period_month")
      .eq("id", line.data.payroll_run_id)
      .maybeSingle()
    if (!run.data?.period_year || !run.data.period_month) {
      return empty("This payroll run has no pay period.", { kindError: "This payroll run has no pay period." })
    }
    const gross = Number(line.data.basic_salary) + Number(line.data.allowance) + Number(line.data.bonus)
    const deductions = Number(line.data.deductions) || 0
    const earnSum = input.body.earnings.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    const deductSum = input.body.deductions.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    if (Math.abs(earnSum - gross) > 0.05 || Math.abs(deductSum - deductions) > 0.05) {
      return empty("Earnings and deductions must equal the payroll record.")
    }
    const net = line.data.net_salary == null ? gross - deductions : Number(line.data.net_salary)
    return empty(null, {
      total: net,
      employeeCode: code,
      period: { year: run.data.period_year, month: run.data.period_month },
    })
  }
  if (input.kind === "letter" && !input.body.subject.trim()) return empty("Enter a subject.")
  if (input.kind === "letter" && !input.body.paragraphs.trim()) return empty("Enter the letter.")
  if (input.kind === "delivery_challan" && !input.body.challanLines.some((line) => line.item.trim())) {
    return empty("Add at least one item.")
  }
  if (input.kind === "delivery_challan" && input.purchaseOrderId) {
    const order = await supabase
      .from("vendor_purchase_orders")
      .select("vendor_id, project_id")
      .eq("id", input.purchaseOrderId)
      .maybeSingle()
    const vendor = order.data ? await partyName(supabase, "vendors", order.data.vendor_id) : vendorName
    const project = order.data?.project_id
      ? await lookupName(supabase, "projects", order.data.project_id, "name")
      : projectName
    return empty(null, { party: vendor, project })
  }
  return empty(null, {
    party: input.kind === "completion" || input.kind === "letter" ? clientName : vendorName || clientName,
    project: projectName,
  })
}

async function lookupName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "projects",
  id: string,
  column: "name",
): Promise<string> {
  if (!isUuid(id)) return ""
  const { data } = await supabase.from(table).select(column).eq("id", id).maybeSingle()
  return (data?.name as string | undefined)?.trim() ?? ""
}

async function partyName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "clients" | "vendors",
  id: string,
): Promise<string> {
  if (!isUuid(id)) return ""
  const { data } = await supabase.from(table).select("company_name, person_name").eq("id", id).maybeSingle()
  return data?.company_name?.trim() || data?.person_name?.trim() || ""
}
