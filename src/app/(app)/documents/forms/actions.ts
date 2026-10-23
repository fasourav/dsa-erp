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
  nameCode,
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

  const base = numberFor(input.kind, input.issuedOn, linked.project, linked.party, linked.notice, linked.period)
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
): string {
  if (kind === "delivery_challan") return challanNumber(issuedOn, party, project)
  if (kind === "payment_voucher") return voucherNumber(issuedOn, party, project)
  if (kind === "completion") return certificateNumber(issuedOn, party, project)
  if (kind === "salary_slip" && period) return salaryNumber(period.year, period.month, party)
  if (kind === "letter") return letterNumber(issuedOn, project, notice)
  return `DOC/DSAE/${nameCode(project)}-${nameCode(party)}/${issuedOn.replaceAll("-", "")}`
}

async function linkedFacts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    kind: FormKind
    projectId: string
    clientId: string
    vendorId: string
    vendorPaymentId: string
    operationalExpenseId: string
    payrollLineId: string
    body: FormBody
  },
): Promise<{ error: string | null; total: number; project: string; party: string; notice: boolean; period: { year: number; month: number } | null }> {
  const empty = { total: 0, project: input.body.projectName, party: input.body.partyName, notice: input.body.letterKind === "notice", period: null }
  if (input.kind === "payment_voucher" && input.vendorPaymentId) {
    const payment = await supabase.from("vendor_payments").select("amount").eq("id", input.vendorPaymentId).maybeSingle()
    if (!payment.data) return { ...empty, error: "That vendor payment could not be found." }
    return { ...empty, error: null, total: Number(payment.data.amount) || 0, project: input.body.projectName || "OPS" }
  }
  if (input.kind === "payment_voucher" && input.operationalExpenseId) {
    const expense = await supabase.from("operational_expenses").select("amount").eq("id", input.operationalExpenseId).maybeSingle()
    if (!expense.data) return { ...empty, error: "That expense could not be found." }
    return { ...empty, error: null, total: Number(expense.data.amount) || 0, project: input.body.projectName || "" }
  }
  if (input.kind === "salary_slip" && input.payrollLineId) {
    const line = await supabase
      .from("payroll_lines")
      .select("basic_salary, allowance, bonus, deductions, net_salary, payroll_run_id, employee_id")
      .eq("id", input.payrollLineId)
      .maybeSingle()
    if (!line.data) return { ...empty, error: "That payroll line could not be found." }
    const run = await supabase
      .from("payroll_runs")
      .select("period_year, period_month")
      .eq("id", line.data.payroll_run_id)
      .maybeSingle()
    const gross = Number(line.data.basic_salary) + Number(line.data.allowance) + Number(line.data.bonus)
    const deductions = Number(line.data.deductions) || 0
    const earnSum = input.body.earnings.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    const deductSum = input.body.deductions.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
    if (Math.abs(earnSum - gross) > 0.05 || Math.abs(deductSum - deductions) > 0.05) {
      return { ...empty, error: "Earnings and deductions must equal the payroll record." }
    }
    const net = line.data.net_salary == null ? gross - deductions : Number(line.data.net_salary)
    return {
      error: null,
      total: net,
      project: "",
      party: input.body.partyName,
      notice: false,
      period: run.data ? { year: run.data.period_year, month: run.data.period_month } : null,
    }
  }
  if (input.kind === "letter" && !input.body.subject.trim()) return { ...empty, error: "Enter a subject." }
  if (input.kind === "letter" && !input.body.paragraphs.trim()) return { ...empty, error: "Enter the letter." }
  if (input.kind === "delivery_challan" && !input.body.challanLines.some((line) => line.item.trim())) {
    return { ...empty, error: "Add at least one item." }
  }
  return { ...empty, error: null }
}
