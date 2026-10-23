"use server"

import { randomBytes } from "node:crypto"

import { revalidatePath } from "next/cache"

import { clip, linesToJson, storedLines, storedMilestones } from "@/lib/documents/body"
import {
  isQuotationStatus,
  isWorkOrderStatus,
  type LineInput,
  type MilestoneInput,
} from "@/lib/documents/drafts"
import { grandTotal, priceLines } from "@/lib/documents/present"
import {
  collisionNumber,
  invoiceNumber,
  nextQuotationVersion,
  orderNumber,
  purchaseOrderNumber,
  quotationNumber,
  receiptNumber,
} from "@/lib/documents/numbers"
import { allows, type ModuleKey } from "@/lib/access"
import type { FormKind } from "@/lib/documents/form-model"
import { isUuid } from "@/lib/ids"
import { getAccess } from "@/lib/permissions"
import { isIsoDate } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database.types"

type DocumentClient = Awaited<ReturnType<typeof createClient>>
export type TrashKind =
  | "quotation"
  | "work_order"
  | "invoice"
  | "receipt"
  | "purchase_order"
  | FormKind

const formTrashKinds: FormKind[] = [
  "delivery_challan",
  "payment_voucher",
  "completion",
  "salary_slip",
  "letter",
]

export type DocumentSaveResult = {
  error: string | null
  id?: string
  documentNo?: string
  verifyToken?: string
  version?: string
}

function newToken(): string {
  return randomBytes(32).toString("hex")
}

function newWorkOrderHasPrice(lines: LineInput[]): boolean {
  if (priceLines(lines).subtotal > 0) return true
  return lines.some((line) => line.item.trim() && Number(line.unitPrice) > 0)
}

function partyLabel(company: string | null | undefined, person: string | null | undefined): string {
  return company?.trim() || person?.trim() || ""
}

async function numberTaken(supabase: DocumentClient, value: string): Promise<boolean> {
  const [quotations, orders, issued] = await Promise.all([
    supabase.from("quotations").select("id").eq("document_no", value).limit(1),
    supabase.from("work_orders").select("id").eq("document_no", value).limit(1),
    supabase.from("issued_documents").select("id").eq("document_no", value).limit(1),
  ])
  return Boolean(quotations.data?.length || orders.data?.length || issued.data?.length)
}

async function clientProjectNames(
  supabase: DocumentClient,
  clientId: string,
  projectId: string | null,
): Promise<{ client: string; project: string }> {
  const [client, project] = await Promise.all([
    supabase.from("clients").select("company_name, person_name").eq("id", clientId).maybeSingle(),
    projectId
      ? supabase.from("projects").select("name").eq("id", projectId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    client: partyLabel(client.data?.company_name, client.data?.person_name),
    project: project.data?.name?.trim() ?? "",
  }
}

async function vendorProjectNames(
  supabase: DocumentClient,
  vendorId: string,
  projectId: string | null,
): Promise<{ vendor: string; project: string }> {
  const [vendor, project] = await Promise.all([
    supabase.from("vendors").select("company_name, person_name").eq("id", vendorId).maybeSingle(),
    projectId
      ? supabase.from("projects").select("name").eq("id", projectId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  return {
    vendor: partyLabel(vendor.data?.company_name, vendor.data?.person_name),
    // No project means an operational purchase order. orderNumber codes that as OPS.
    project: projectId ? (project.data?.name?.trim() ?? "") : "",
  }
}

async function leadQuotationVersion(supabase: DocumentClient, leadId: string): Promise<number> {
  if (!isUuid(leadId)) return 1
  const { data } = await supabase.from("quotations").select("document_no").eq("lead_id", leadId)
  return nextQuotationVersion((data ?? []).map((row) => row.document_no))
}

async function quotationVersionFor(
  supabase: DocumentClient,
  clientId: string,
  projectId: string | null,
): Promise<number> {
  const query = supabase.from("quotations").select("document_no").eq("client_id", clientId)
  const { data } = projectId
    ? await query.eq("project_id", projectId)
    : await query.is("project_id", null)
  return nextQuotationVersion((data ?? []).map((row) => row.document_no))
}

function writeError(error: { message?: string; code?: string } | null, fallback: string): string | null {
  if (!error) return null
  const text = `${error.code ?? ""} ${error.message ?? ""}`
  if (/42P01|PGRST205|schema cache|does not exist|Could not find the table/i.test(text)) {
    return "Document storage is not available until the business documents migration is applied."
  }
  if (error.code === "23505") return "That document number is already in use."
  if (error.code === "40001") return "This record was changed by someone else — reload."
  if (/unit_price_nonneg/.test(text)) return "Unit price can't be negative."
  if (/valid_after_issue/.test(text)) return "Valid until must be on or after the issue date."
  return fallback
}

async function guardWrite(module: ModuleKey, exists: boolean): Promise<string | null> {
  const access = await getAccess()
  if (!access || access.status === "deactivated") return "Your session has expired. Sign in again."
  if (!allows(access, module, exists ? "edit" : "add")) {
    return "You do not have permission to do that."
  }
  return null
}

function optionalDate(value: string, label: string): string | null {
  if (!value.trim()) return null
  if (!isIsoDate(value)) return `Enter a valid ${label}.`
  return null
}

function percentOrZero(value: string): number | null {
  if (value.trim() === "") return 0
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null
  return Math.round(parsed * 100) / 100
}

export async function saveInvoicePrint(input: {
  invoiceId: string
  dueOn: string
  billToName: string
  billToDetail: string
  workOrderNo: string
  aitPercent: string
  terms: string
  paymentNote: string
  subtitle: string
  preparedBy: string
  checkedBy: string
  authorizedBy: string
  lines: LineInput[]
}): Promise<DocumentSaveResult> {
  if (!isUuid(input.invoiceId)) return { error: "That invoice could not be found." }
  const dueError = optionalDate(input.dueOn, "due date")
  if (dueError) return { error: dueError }
  const ait = percentOrZero(input.aitPercent)
  if (ait === null) return { error: "Enter an AIT percent from 0 to 100." }
  if (!input.lines.some((line) => line.item.trim())) {
    return { error: "Add at least one item." }
  }

  const supabase = await createClient()
  const existing = await supabase
    .from("issued_documents")
    .select("id, document_no, verify_token")
    .eq("client_invoice_id", input.invoiceId)
    .is("deleted_at", null)
    .maybeSingle()
  if (existing.error) return { error: writeError(existing.error, "Could not save this invoice.") }
  const denied = await guardWrite("client_invoices", Boolean(existing.data))
  if (denied) return { error: denied }

  const invoice = await supabase
    .from("client_invoices")
    .select("id, issued_on, status, client_id, project_id, amount")
    .eq("id", input.invoiceId)
    .maybeSingle()
  if (invoice.error || !invoice.data || invoice.data.status === "void") {
    return { error: "That invoice could not be found." }
  }

  const book = Math.max(0, Number(invoice.data.amount) || 0)
  const computed = grandTotal(input.lines, String(ait))
  if (Math.abs(computed - book) > 0.05) {
    return { error: "Item totals must equal the invoice amount." }
  }
  const total = book
  const body: Json = {
    dueOn: clip(input.dueOn, 10),
    billToName: clip(input.billToName, 160),
    billToDetail: clip(input.billToDetail, 500),
    workOrderNo: clip(input.workOrderNo, 80),
    aitPercent: String(ait),
    terms: clip(input.terms, 2000),
    paymentNote: clip(input.paymentNote, 1000),
    subtitle: clip(input.subtitle, 160),
    preparedBy: clip(input.preparedBy, 120),
    checkedBy: clip(input.checkedBy, 120),
    authorizedBy: clip(input.authorizedBy, 120),
    lines: linesToJson(input.lines),
  }
  const issuedOn = invoice.data.issued_on

  if (existing.data) {
    const { error } = await supabase
      .from("issued_documents")
      .update({
        issued_on: issuedOn,
        total,
        status: invoice.data.status,
        body,
      })
      .eq("id", existing.data.id)
    const message = writeError(error, "Could not save this invoice.")
    if (message) return { error: message }
    revalidatePath("/documents/invoices")
    revalidatePath(`/documents/invoices/${input.invoiceId}`)
    return {
      error: null,
      id: input.invoiceId,
      documentNo: existing.data.document_no,
      verifyToken: existing.data.verify_token,
    }
  }

  const names = await clientProjectNames(supabase, invoice.data.client_id, invoice.data.project_id)
  const base = invoiceNumber(issuedOn.slice(0, 10), names.client, names.project)
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const documentNo = collisionNumber(base, attempt)
    if (await numberTaken(supabase, documentNo)) continue
    const verifyToken = newToken()
    const { error } = await supabase.from("issued_documents").insert({
      kind: "invoice",
      client_invoice_id: input.invoiceId,
      document_no: documentNo,
      issued_on: issuedOn,
      total,
      status: invoice.data.status,
      verify_token: verifyToken,
      body,
    })
    if (!error) {
      revalidatePath("/documents/invoices")
      revalidatePath(`/documents/invoices/${input.invoiceId}`)
      return { error: null, id: input.invoiceId, documentNo, verifyToken }
    }
    if (error.code !== "23505") return { error: writeError(error, "Could not save this invoice.") }
  }

  return { error: "Could not assign a document number." }
}

export async function saveReceiptPrint(input: {
  paymentId: string
  receivedFromName: string
  receivedFromDetail: string
  againstInvoiceNo: string
  method: string
  reference: string
  description: string
  transferMode: string
  creditedTo: string
  notes: string
  subtitle: string
  preparedBy: string
  checkedBy: string
  authorizedBy?: string
}): Promise<DocumentSaveResult> {
  if (!isUuid(input.paymentId)) return { error: "That payment could not be found." }
  if (!input.description.trim()) return { error: "Enter what this receipt is for." }

  const supabase = await createClient()
  const existing = await supabase
    .from("issued_documents")
    .select("id, document_no, verify_token")
    .eq("client_payment_id", input.paymentId)
    .is("deleted_at", null)
    .maybeSingle()
  if (existing.error) return { error: writeError(existing.error, "Could not save this receipt.") }
  const denied = await guardWrite("client_invoices", Boolean(existing.data))
  if (denied) return { error: denied }

  const payment = await supabase
    .from("client_payments")
    .select("id, paid_on, amount, client_invoice_id")
    .eq("id", input.paymentId)
    .maybeSingle()
  if (payment.error || !payment.data) return { error: "That payment could not be found." }

  const body: Json = {
    receivedFromName: clip(input.receivedFromName, 160),
    receivedFromDetail: clip(input.receivedFromDetail, 500),
    againstInvoiceNo: clip(input.againstInvoiceNo, 80),
    method: clip(input.method, 80),
    reference: clip(input.reference, 80),
    description: clip(input.description, 500),
    transferMode: clip(input.transferMode, 80),
    creditedTo: clip(input.creditedTo, 160),
    notes: clip(input.notes, 1000),
    subtitle: clip(input.subtitle, 160),
    preparedBy: clip(input.preparedBy, 120),
    checkedBy: clip(input.checkedBy, 120),
    authorizedBy: clip(input.authorizedBy ?? "", 120),
  }
  const issuedOn = payment.data.paid_on
  const total = Number(payment.data.amount)

  if (existing.data) {
    const { error } = await supabase
      .from("issued_documents")
      .update({
        issued_on: issuedOn,
        total,
        status: "received",
        body,
      })
      .eq("id", existing.data.id)
    const message = writeError(error, "Could not save this receipt.")
    if (message) return { error: message }
    revalidatePath("/documents/receipts")
    revalidatePath(`/documents/receipts/${input.paymentId}`)
    return {
      error: null,
      id: input.paymentId,
      documentNo: existing.data.document_no,
      verifyToken: existing.data.verify_token,
    }
  }

  const bill = await supabase
    .from("client_invoices")
    .select("client_id, project_id")
    .eq("id", payment.data.client_invoice_id)
    .maybeSingle()
  const names = await clientProjectNames(
    supabase,
    bill.data?.client_id ?? "",
    bill.data?.project_id ?? null,
  )
  const base = receiptNumber(issuedOn.slice(0, 10), names.client, names.project)
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const documentNo = collisionNumber(base, attempt)
    if (await numberTaken(supabase, documentNo)) continue
    const verifyToken = newToken()
    const { error } = await supabase.from("issued_documents").insert({
      kind: "receipt",
      client_payment_id: input.paymentId,
      document_no: documentNo,
      issued_on: issuedOn,
      total,
      status: "received",
      verify_token: verifyToken,
      body,
    })
    if (!error) {
      revalidatePath("/documents/receipts")
      revalidatePath(`/documents/receipts/${input.paymentId}`)
      return { error: null, id: input.paymentId, documentNo, verifyToken }
    }
    if (error.code !== "23505") return { error: writeError(error, "Could not save this receipt.") }
  }
  return { error: "Could not assign a document number." }
}

export async function savePurchaseOrderPrint(input: {
  purchaseOrderId: string
  vendorDetail: string
  site: string
  receiver: string
  deliveryOn: string
  lines: LineInput[]
  carrying: string
  terms: string
  subtitle: string
  preparedBy: string
  checkedBy: string
  authorizedBy: string
}): Promise<DocumentSaveResult> {
  if (!isUuid(input.purchaseOrderId)) return { error: "That purchase order could not be found." }
  const deliveryError = optionalDate(input.deliveryOn, "delivery date")
  if (deliveryError) return { error: deliveryError }
  if (!input.lines.some((line) => line.item.trim())) return { error: "Add at least one item." }
  const carrying = input.carrying.trim() === "" ? 0 : Number(input.carrying)
  if (!Number.isFinite(carrying) || carrying < 0) return { error: "Enter a carrying amount of 0 or more." }

  const supabase = await createClient()
  const existing = await supabase
    .from("issued_documents")
    .select("id, document_no, verify_token")
    .eq("purchase_order_id", input.purchaseOrderId)
    .is("deleted_at", null)
    .maybeSingle()
  if (existing.error) return { error: writeError(existing.error, "Could not save this purchase order.") }
  const denied = await guardWrite("purchase_orders", Boolean(existing.data))
  if (denied) return { error: denied }

  const order = await supabase
    .from("vendor_purchase_orders")
    .select("id, issued_on, vendor_id, project_id, total_value")
    .eq("id", input.purchaseOrderId)
    .maybeSingle()
  if (order.error || !order.data) return { error: "That purchase order could not be found." }

  const book = Math.max(0, Number(order.data.total_value) || 0)
  const computed = grandTotal(input.lines, "0", carrying)
  if (Math.abs(computed - book) > 0.05) {
    return { error: "Item totals must equal the purchase order amount." }
  }
  const total = book
  const body: Json = {
    vendorDetail: clip(input.vendorDetail, 500),
    site: clip(input.site, 200),
    receiver: clip(input.receiver, 120),
    deliveryOn: clip(input.deliveryOn, 10),
    carrying: String(carrying),
    terms: clip(input.terms, 2000),
    subtitle: clip(input.subtitle, 160),
    preparedBy: clip(input.preparedBy, 120),
    checkedBy: clip(input.checkedBy, 120),
    authorizedBy: clip(input.authorizedBy, 120),
    lines: linesToJson(input.lines),
  }

  if (existing.data) {
    const { error } = await supabase
      .from("issued_documents")
      .update({
        issued_on: order.data.issued_on,
        total,
        status: "issued",
        body,
      })
      .eq("id", existing.data.id)
    const message = writeError(error, "Could not save this purchase order.")
    if (message) return { error: message }
    revalidatePath("/documents/purchase-orders")
    revalidatePath(`/documents/purchase-orders/${input.purchaseOrderId}`)
    return {
      error: null,
      id: input.purchaseOrderId,
      documentNo: existing.data.document_no,
      verifyToken: existing.data.verify_token,
    }
  }

  const names = await vendorProjectNames(supabase, order.data.vendor_id, order.data.project_id)
  const base = purchaseOrderNumber(order.data.issued_on.slice(0, 10), names.vendor, names.project)
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const documentNo = collisionNumber(base, attempt)
    if (await numberTaken(supabase, documentNo)) continue
    const verifyToken = newToken()
    const { error } = await supabase.from("issued_documents").insert({
      kind: "purchase_order",
      purchase_order_id: input.purchaseOrderId,
      document_no: documentNo,
      issued_on: order.data.issued_on,
      total,
      status: "issued",
      verify_token: verifyToken,
      body,
    })
    if (!error) {
      revalidatePath("/documents/purchase-orders")
      revalidatePath(`/documents/purchase-orders/${input.purchaseOrderId}`)
      return { error: null, id: input.purchaseOrderId, documentNo, verifyToken }
    }
    if (error.code !== "23505") return { error: writeError(error, "Could not save this purchase order.") }
  }
  return { error: "Could not assign a document number." }
}

// One RPC call saves the header, lines and payment schedule in a single
// transaction, so a failing line can't leave a header with a stale total.
async function saveDocumentAtomically(
  kind: "quotation" | "work_order",
  input: { id: string | null; version?: string; issuedOn: string; lines: LineInput[]; milestones: MilestoneInput[] },
  fields: Record<string, unknown>,
  base: string,
  fallback: string,
): Promise<DocumentSaveResult> {
  const supabase = await createClient()
  const lines = storedLines(input.lines)
  const milestones = storedMilestones(input.milestones)
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const documentNo = collisionNumber(base, attempt)
    if (!input.id && (await numberTaken(supabase, documentNo))) continue
    const payload = input.id
      ? fields
      : { ...fields, document_no: documentNo, verify_token: newToken() }
    const { data, error } = await supabase.rpc("save_business_document", {
      p_kind: kind,
      p_id: input.id ?? undefined,
      p_version: input.id ? input.version : undefined,
      p_fields: payload as Json,
      p_lines: lines as unknown as Json,
      p_milestones: milestones as unknown as Json,
    })
    if (!error) {
      const saved = (data ?? {}) as { id?: string; document_no?: string; verify_token?: string; version?: string }
      if (!saved.id) return { error: fallback }
      return {
        error: null,
        id: saved.id,
        documentNo: saved.document_no,
        verifyToken: saved.verify_token,
        version: saved.version,
      }
    }
    if (input.id || error.code !== "23505" || !/document_no|verify_token/.test(error.message ?? "")) {
      return { error: writeError(error, fallback) }
    }
  }
  return { error: "Could not assign a document number." }
}

export async function saveQuotation(input: {
  id: string | null
  version?: string
  issuedOn: string
  validUntil: string
  status: string
  clientId: string
  leadId: string
  projectId: string
  area: string
  subject: string
  terms: string
  exclusions: string
  aitPercent: string
  subtitle: string
  preparedBy: string
  checkedBy: string
  authorizedBy: string
  lines: LineInput[]
  milestones: MilestoneInput[]
}): Promise<DocumentSaveResult> {
  if (!isIsoDate(input.issuedOn)) return { error: "Enter an issue date." }
  const validError = optionalDate(input.validUntil, "valid until date")
  if (validError) return { error: validError }
  if (!isQuotationStatus(input.status)) return { error: "Choose a status." }
  if (!isUuid(input.clientId) && !isUuid(input.leadId ?? "")) return { error: "Choose a client or a lead." }
  if (input.projectId && !isUuid(input.projectId)) return { error: "Choose a project." }
  const ait = percentOrZero(input.aitPercent)
  if (ait === null) return { error: "Enter an AIT percent from 0 to 100." }
  if (!input.lines.some((line) => line.item.trim())) return { error: "Add at least one item." }
  if (input.validUntil && input.validUntil < input.issuedOn) {
    return { error: "Valid until must be on or after the issue date." }
  }
  if (input.lines.some((line) => Number(line.unitPrice) < 0)) return { error: "Unit price can't be negative." }

  const supabase = await createClient()
  const exists = Boolean(input.id)
  const denied = await guardWrite("quotations", exists)
  if (denied) return { error: denied }
  if (input.id && !isUuid(input.id)) return { error: "That quotation could not be found." }

  let leadName = ""
  let leadProject = ""
  if (isUuid(input.clientId)) {
    const client = await supabase.from("clients").select("id").eq("id", input.clientId).maybeSingle()
    if (client.error || !client.data) return { error: "Choose a client." }
  } else if (isUuid(input.leadId ?? "")) {
    const lead = await supabase
      .from("leads")
      .select("id, lead_name, project_name")
      .eq("id", input.leadId)
      .maybeSingle()
    if (lead.error || !lead.data) return { error: "Choose a lead." }
    leadName = lead.data.lead_name
    leadProject = lead.data.project_name?.trim() ?? ""
  }
  if (input.projectId) {
    const project = await supabase
      .from("projects")
      .select("id, client_id")
      .eq("id", input.projectId)
      .maybeSingle()
    if (project.error || !project.data) return { error: "Choose a project." }
    if (isUuid(input.clientId) && project.data.client_id !== input.clientId) {
      return { error: "Choose a project for this client." }
    }
  }

  const total = grandTotal(input.lines, String(ait))
  const fields = {
    issued_on: input.issuedOn,
    valid_until: input.validUntil || null,
    status: input.status,
    client_id: isUuid(input.clientId) ? input.clientId : null,
    lead_id: isUuid(input.leadId ?? "") ? input.leadId : null,
    project_id: input.projectId || null,
    area: clip(input.area, 120),
    subject: clip(input.subject, 300),
    terms: clip(input.terms, 4000),
    exclusions: clip(input.exclusions, 2000),
    ait_percent: ait,
    total,
    subtitle: clip(input.subtitle, 160),
    prepared_by: clip(input.preparedBy, 120),
    checked_by: clip(input.checkedBy, 120),
    authorized_by: clip(input.authorizedBy, 120),
  }

  const names = isUuid(input.clientId)
    ? await clientProjectNames(supabase, input.clientId, input.projectId || null)
    : {
        client: leadName,
        project: input.projectId
          ? ((await supabase.from("projects").select("name").eq("id", input.projectId).maybeSingle()).data?.name ?? leadProject)
          : leadProject,
      }
  const version = isUuid(input.clientId)
    ? await quotationVersionFor(supabase, input.clientId, input.projectId || null)
    : await leadQuotationVersion(supabase, input.leadId ?? "")
  const base = quotationNumber(input.issuedOn, names.client, names.project, version)
  const saved = await saveDocumentAtomically("quotation", input, fields, base, "Could not save this quotation.")
  if (saved.error || !saved.id) return saved
  const id = saved.id
  revalidatePath("/documents/quotations")
  revalidatePath(`/documents/quotations/${id}`)
  return saved
}

export async function saveWorkOrder(input: {
  id: string | null
  version?: string
  issuedOn: string
  status: string
  vendorId: string
  projectId: string
  purchaseOrderId?: string
  proposalOn: string
  workStart: string
  workEnd: string
  subject: string
  introduction: string
  terms: string
  subtitle: string
  preparedBy: string
  checkedBy: string
  authorizedBy: string
  lines: LineInput[]
  milestones: MilestoneInput[]
}): Promise<DocumentSaveResult> {
  if (!isIsoDate(input.issuedOn)) return { error: "Enter an issue date." }
  const proposalError = optionalDate(input.proposalOn, "proposal date")
  if (proposalError) return { error: proposalError }
  const startError = optionalDate(input.workStart, "work start date")
  if (startError) return { error: startError }
  const endError = optionalDate(input.workEnd, "work end date")
  if (endError) return { error: endError }
  if (!isWorkOrderStatus(input.status)) return { error: "Choose a status." }
  const purchaseOrderId = input.purchaseOrderId?.trim() ?? ""
  if (!input.id && !purchaseOrderId) return { error: "Choose a purchase order." }
  if (purchaseOrderId && !isUuid(purchaseOrderId)) return { error: "Choose a purchase order." }
  if (!purchaseOrderId && !isUuid(input.vendorId)) return { error: "Choose a vendor." }
  if (input.projectId && !isUuid(input.projectId)) return { error: "Choose a project." }
  if (!input.lines.some((line) => line.item.trim())) return { error: "Add at least one item." }
  if (input.lines.some((line) => Number(line.unitPrice) < 0)) return { error: "Unit price can't be negative." }
  if (!input.id && !newWorkOrderHasPrice(input.lines)) {
    return { error: "Add at least one item with a price." }
  }

  const supabase = await createClient()
  const denied = await guardWrite("work_orders", Boolean(input.id))
  if (denied) return { error: denied }
  if (input.id && !isUuid(input.id)) return { error: "That work order could not be found." }

  // A work order linked to a purchase order stays linked (it is that PO's printable form);
  // it can move to another PO but not be cleared. Older work orders without a PO still save.
  let previousPurchaseOrderId = ""
  if (input.id) {
    const current = await supabase.from("work_orders").select("purchase_order_id").eq("id", input.id).maybeSingle()
    if (current.error || !current.data) return { error: "That work order could not be found." }
    previousPurchaseOrderId = current.data.purchase_order_id ?? ""
    if (previousPurchaseOrderId && !purchaseOrderId) {
      return { error: "This work order belongs to a purchase order. Choose a purchase order; it can't be removed." }
    }
  }

  // A linked work order takes its vendor and project from the purchase order so they can't drift.
  let vendorId = input.vendorId
  let projectId = input.projectId
  if (purchaseOrderId) {
    const order = await supabase
      .from("vendor_purchase_orders")
      .select("vendor_id, project_id")
      .eq("id", purchaseOrderId)
      .maybeSingle()
    if (order.error || !order.data) return { error: "Choose a purchase order." }
    vendorId = order.data.vendor_id
    projectId = order.data.project_id ?? ""
  }

  const vendor = await supabase.from("vendors").select("id").eq("id", vendorId).maybeSingle()
  if (vendor.error || !vendor.data) return { error: "Choose a vendor." }

  const total = priceLines(input.lines).subtotal
  const fields = {
    issued_on: input.issuedOn,
    status: input.status,
    vendor_id: vendorId,
    project_id: projectId || null,
    ...(purchaseOrderId ? { purchase_order_id: purchaseOrderId } : {}),
    proposal_on: input.proposalOn || null,
    work_start: input.workStart || null,
    work_end: input.workEnd || null,
    subject: clip(input.subject, 300),
    introduction: clip(input.introduction, 2000),
    terms: clip(input.terms, 4000),
    total,
    subtitle: clip(input.subtitle, 160),
    prepared_by: clip(input.preparedBy, 120),
    checked_by: clip(input.checkedBy, 120),
    authorized_by: clip(input.authorizedBy, 120),
  }

  const names = await vendorProjectNames(supabase, vendorId, projectId || null)
  const base = orderNumber(input.issuedOn, names.vendor, names.project)
  const saved = await saveDocumentAtomically("work_order", input, fields, base, "Could not save this work order.")
  if (saved.error || !saved.id) return saved
  const id = saved.id
  revalidatePath("/documents/work-orders")
  revalidatePath(`/documents/work-orders/${id}`)
  if (purchaseOrderId) revalidatePath(`/purchase-orders/${purchaseOrderId}`)
  if (previousPurchaseOrderId && previousPurchaseOrderId !== purchaseOrderId) {
    revalidatePath(`/purchase-orders/${previousPurchaseOrderId}`)
  }
  return saved
}

const duplicatePrintMessage =
  "A newer saved document already uses that record. Delete it before restoring this one."

function revalidateDocument(kind: TrashKind) {
  revalidatePath("/documents")
  revalidatePath("/documents/trash")
  if (kind === "quotation") revalidatePath("/documents/quotations")
  if (kind === "work_order") revalidatePath("/documents/work-orders")
  if (kind === "invoice") revalidatePath("/documents/invoices")
  if (kind === "receipt") revalidatePath("/documents/receipts")
  if (kind === "purchase_order") revalidatePath("/documents/purchase-orders")
  if (formTrashKinds.includes(kind as FormKind)) {
    const slug =
      kind === "delivery_challan"
        ? "challans"
        : kind === "payment_voucher"
          ? "vouchers"
          : kind === "completion"
            ? "certificates"
            : kind === "salary_slip"
              ? "salary-slips"
              : "letters"
    revalidatePath(`/documents/${slug}`)
  }
}

async function requireOwner(): Promise<{ userId: string } | { error: string }> {
  const access = await getAccess()
  if (!access || access.status === "deactivated") return { error: "Your session has expired. Sign in again." }
  if (!access.isOwner) return { error: "Only owners can do that." }
  return { userId: access.userId }
}

export async function trashSavedDocument(input: {
  kind: TrashKind
  id: string
}): Promise<{ error: string | null }> {
  if (!isUuid(input.id)) return { error: "That document could not be found." }
  const owner = await requireOwner()
  if ("error" in owner) return { error: owner.error }
  const supabase = await createClient()
  const patch = { deleted_at: new Date().toISOString(), deleted_by: owner.userId }
  const result = await applyTrash(supabase, input.kind, input.id, "trash", patch)
  if (result.error) return result
  revalidateDocument(input.kind)
  return { error: null }
}

export async function restoreSavedDocument(input: {
  kind: TrashKind
  id: string
}): Promise<{ error: string | null }> {
  if (!isUuid(input.id)) return { error: "That document could not be found." }
  const owner = await requireOwner()
  if ("error" in owner) return { error: owner.error }
  const supabase = await createClient()
  const result = await applyTrash(supabase, input.kind, input.id, "restore", {
    deleted_at: null,
    deleted_by: null,
  })
  if (result.error) return result
  revalidateDocument(input.kind)
  return { error: null }
}

export async function deleteSavedDocumentForever(input: {
  kind: TrashKind
  id: string
}): Promise<{ error: string | null }> {
  if (!isUuid(input.id)) return { error: "That document could not be found." }
  const owner = await requireOwner()
  if ("error" in owner) return { error: owner.error }
  const supabase = await createClient()
  const result = await applyTrash(supabase, input.kind, input.id, "delete", null)
  if (result.error) return result
  revalidateDocument(input.kind)
  return { error: null }
}

async function applyTrash(
  supabase: DocumentClient,
  kind: TrashKind,
  id: string,
  mode: "trash" | "restore" | "delete",
  patch: { deleted_at: string | null; deleted_by: string | null } | null,
): Promise<{ error: string | null }> {
  const missing = "That document could not be found."
  if (formTrashKinds.includes(kind as FormKind)) {
    if (mode === "delete") {
      const { data, error } = await supabase
        .from("form_documents")
        .delete()
        .eq("id", id)
        .eq("kind", kind)
        .not("deleted_at", "is", null)
        .select("id")
      if (error) return { error: writeError(error, "Could not delete this document.") }
      if (!data?.length) return { error: missing }
      return { error: null }
    }
    const query = supabase
      .from("form_documents")
      .update(patch ?? { deleted_at: null, deleted_by: null })
      .eq("id", id)
      .eq("kind", kind)
    const filtered = mode === "trash" ? query.is("deleted_at", null) : query.not("deleted_at", "is", null)
    const { data, error } = await filtered.select("id")
    if (error) return { error: writeError(error, "Could not update this document.") }
    if (!data?.length) return { error: missing }
    return { error: null }
  }
  if (kind === "quotation" || kind === "work_order") {
    const table = kind === "quotation" ? "quotations" : "work_orders"
    if (mode === "delete") {
      const { data, error } = await supabase
        .from(table)
        .delete()
        .eq("id", id)
        .not("deleted_at", "is", null)
        .select("id")
      if (error) return { error: writeError(error, "Could not delete this document.") }
      if (!data?.length) return { error: missing }
      return { error: null }
    }
    const query = supabase
      .from(table)
      .update(patch ?? { deleted_at: null, deleted_by: null })
      .eq("id", id)
    const filtered = mode === "trash" ? query.is("deleted_at", null) : query.not("deleted_at", "is", null)
    const { data, error } = await filtered.select("id")
    if (error?.code === "23505" && mode === "restore") {
      return { error: duplicatePrintMessage }
    }
    if (error) {
      return {
        error: writeError(
          error,
          mode === "restore" ? "Could not restore this document." : "Could not move this document to Trash.",
        ),
      }
    }
    if (!data?.length) return { error: missing }
    return { error: null }
  }

  const column =
    kind === "invoice" ? "client_invoice_id" : kind === "receipt" ? "client_payment_id" : "purchase_order_id"
  const issuedKind = kind === "invoice" ? "invoice" : kind === "receipt" ? "receipt" : "purchase_order"
  if (mode === "delete") {
    const { data, error } = await supabase
      .from("issued_documents")
      .update({ status: "deleted" })
      .eq("id", id)
      .eq("kind", issuedKind)
      .not("deleted_at", "is", null)
      .select("id")
    if (error) return { error: writeError(error, "Could not delete this document.") }
    if (!data?.length) return { error: missing }
    return { error: null }
  }
  if (mode === "restore") {
    const blocked = await activePrintBlocksRestore(supabase, id, issuedKind, column)
    if (blocked) return { error: blocked }
    const { data: trashedRow, error: trashedError } = await supabase
      .from("issued_documents")
      .select("id, status")
      .eq("id", id)
      .eq("kind", issuedKind)
      .not("deleted_at", "is", null)
      .maybeSingle()
    if (trashedError) return { error: writeError(trashedError, "Could not restore this document.") }
    if (!trashedRow) return { error: missing }
    if (trashedRow.status === "draft") {
      const { error: delError } = await supabase
        .from("issued_documents")
        .delete()
        .eq("id", id)
        .eq("kind", issuedKind)
        .not("deleted_at", "is", null)
      if (delError) return { error: writeError(delError, "Could not restore this document.") }
      return { error: null }
    }
    const { data, error } = await supabase
      .from("issued_documents")
      .update(patch ?? { deleted_at: null, deleted_by: null })
      .eq("id", id)
      .eq("kind", issuedKind)
      .not("deleted_at", "is", null)
      .select("id")
    if (error?.code === "23505") return { error: duplicatePrintMessage }
    if (error) return { error: writeError(error, "Could not restore this document.") }
    if (!data?.length) return { error: missing }
    return { error: null }
  }

  const { data, error } = await supabase
    .from("issued_documents")
    .update(patch ?? { deleted_at: null, deleted_by: null })
    .eq(column, id)
    .eq("kind", issuedKind)
    .is("deleted_at", null)
    .select("id")
  if (error) {
    return { error: writeError(error, "Could not move this document to Trash.") }
  }
  if (data?.length) return { error: null }

  return trashUnprintedDocument(supabase, issuedKind, column, id, patch)
}

async function trashUnprintedDocument(
  supabase: DocumentClient,
  issuedKind: "invoice" | "receipt" | "purchase_order",
  column: "client_invoice_id" | "client_payment_id" | "purchase_order_id",
  parentId: string,
  patch: { deleted_at: string | null; deleted_by: string | null } | null,
): Promise<{ error: string | null }> {
  const missing = "That document could not be found."
  if (!patch?.deleted_at) return { error: missing }

  const existingTrashed = await supabase
    .from("issued_documents")
    .select("id")
    .eq(column, parentId)
    .eq("kind", issuedKind)
    .not("deleted_at", "is", null)
    .limit(1)
  if (existingTrashed.data?.[0]?.id) {
    const { error } = await supabase
      .from("issued_documents")
      .update({ ...patch, status: "draft" })
      .eq("id", existingTrashed.data[0].id)
    if (error) return { error: writeError(error, "Could not move this document to Trash.") }
    return { error: null }
  }

  let issuedOn = ""
  let total = 0
  let base = ""

  if (issuedKind === "purchase_order") {
    const order = await supabase
      .from("vendor_purchase_orders")
      .select("id, issued_on, total_value, vendor_id, project_id")
      .eq("id", parentId)
      .maybeSingle()
    if (order.error || !order.data) return { error: missing }
    issuedOn = order.data.issued_on
    total = Math.max(0, Number(order.data.total_value) || 0)
    const names = await vendorProjectNames(supabase, order.data.vendor_id, order.data.project_id)
    base = purchaseOrderNumber(issuedOn.slice(0, 10), names.vendor, names.project)
  } else if (issuedKind === "invoice") {
    const invoice = await supabase
      .from("client_invoices")
      .select("id, issued_on, amount, status, client_id, project_id")
      .eq("id", parentId)
      .maybeSingle()
    if (invoice.error || !invoice.data || invoice.data.status === "void") return { error: missing }
    issuedOn = invoice.data.issued_on
    total = Math.max(0, Number(invoice.data.amount) || 0)
    const names = await clientProjectNames(supabase, invoice.data.client_id, invoice.data.project_id)
    base = invoiceNumber(issuedOn.slice(0, 10), names.client, names.project)
  } else {
    const payment = await supabase
      .from("client_payments")
      .select("id, paid_on, amount, client_invoice_id")
      .eq("id", parentId)
      .maybeSingle()
    if (payment.error || !payment.data) return { error: missing }
    issuedOn = payment.data.paid_on
    total = Math.max(0, Number(payment.data.amount) || 0)
    const bill = await supabase
      .from("client_invoices")
      .select("client_id, project_id")
      .eq("id", payment.data.client_invoice_id)
      .maybeSingle()
    const names = await clientProjectNames(
      supabase,
      bill.data?.client_id ?? "",
      bill.data?.project_id ?? null,
    )
    base = receiptNumber(issuedOn.slice(0, 10), names.client, names.project)
  }

  for (let attempt = 1; attempt <= 16; attempt += 1) {
    const documentNo =
      attempt <= 8
        ? collisionNumber(base, attempt)
        : `${base}-${randomBytes(2).toString("hex").toUpperCase()}`
    if (await numberTaken(supabase, documentNo)) continue
    const { data: inserted, error: insertError } = await supabase
      .from("issued_documents")
      .insert({
        kind: issuedKind,
        client_invoice_id: column === "client_invoice_id" ? parentId : null,
        client_payment_id: column === "client_payment_id" ? parentId : null,
        purchase_order_id: column === "purchase_order_id" ? parentId : null,
        document_no: documentNo,
        issued_on: issuedOn,
        total,
        status: "draft",
        verify_token: newToken(),
        body: {},
      })
      .select("id")
      .single()
    if (insertError) {
      if (insertError.code === "23505") continue
      return { error: writeError(insertError, "Could not move this document to Trash.") }
    }
    const { error: trashError } = await supabase
      .from("issued_documents")
      .update(patch)
      .eq("id", inserted.id)
    if (trashError) {
      return { error: writeError(trashError, "Could not move this document to Trash.") }
    }
    return { error: null }
  }

  return { error: "Could not move this document to Trash." }
}

async function activePrintBlocksRestore(
  supabase: DocumentClient,
  id: string,
  issuedKind: "invoice" | "receipt" | "purchase_order",
  column: "client_invoice_id" | "client_payment_id" | "purchase_order_id",
): Promise<string | null> {
  const { data: row, error } = await supabase
    .from("issued_documents")
    .select("id, client_invoice_id, client_payment_id, purchase_order_id")
    .eq("id", id)
    .eq("kind", issuedKind)
    .not("deleted_at", "is", null)
    .maybeSingle()
  if (error || !row) return null
  const parentId = row[column]
  if (!parentId) return null
  const { data: live, error: liveError } = await supabase
    .from("issued_documents")
    .select("id")
    .eq("kind", issuedKind)
    .eq(column, parentId)
    .is("deleted_at", null)
    .limit(1)
  if (liveError || !live?.length) return null
  return duplicatePrintMessage
}
