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
import { allows, type ModuleKey } from "@/lib/access"
import { isUuid } from "@/lib/ids"
import { getAccess } from "@/lib/permissions"
import { isIsoDate } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database.types"

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

function newDocumentNo(prefix: string, issuedOn: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(issuedOn)
  const stamp = match ? `${match[3]}${match[2]}${match[1]}` : "00000000"
  return `${prefix}/DSAE/${randomBytes(2).toString("hex").toUpperCase()}/${stamp}`
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
  preparedBy: string
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
    .maybeSingle()
  if (existing.error) return { error: writeError(existing.error, "Could not save this invoice.") }
  const denied = await guardWrite("client_invoices", Boolean(existing.data))
  if (denied) return { error: denied }

  const invoice = await supabase
    .from("client_invoices")
    .select("id, issued_on, status")
    .eq("id", input.invoiceId)
    .maybeSingle()
  if (invoice.error || !invoice.data || invoice.data.status === "void") {
    return { error: "That invoice could not be found." }
  }

  const total = grandTotal(input.lines, String(ait))
  const body: Json = {
    dueOn: clip(input.dueOn, 10),
    billToName: clip(input.billToName, 160),
    billToDetail: clip(input.billToDetail, 500),
    workOrderNo: clip(input.workOrderNo, 80),
    aitPercent: String(ait),
    terms: clip(input.terms, 2000),
    paymentNote: clip(input.paymentNote, 1000),
    preparedBy: clip(input.preparedBy, 120),
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

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const documentNo = newDocumentNo("INV", issuedOn.slice(0, 10))
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
  preparedBy: string
}): Promise<DocumentSaveResult> {
  if (!isUuid(input.paymentId)) return { error: "That payment could not be found." }
  if (!input.description.trim()) return { error: "Enter what this receipt is for." }

  const supabase = await createClient()
  const existing = await supabase
    .from("issued_documents")
    .select("id, document_no, verify_token")
    .eq("client_payment_id", input.paymentId)
    .maybeSingle()
  if (existing.error) return { error: writeError(existing.error, "Could not save this receipt.") }
  const denied = await guardWrite("client_invoices", Boolean(existing.data))
  if (denied) return { error: denied }

  const payment = await supabase
    .from("client_payments")
    .select("id, paid_on, amount")
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
    preparedBy: clip(input.preparedBy, 120),
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

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const documentNo = newDocumentNo("MR", issuedOn.slice(0, 10))
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
    .maybeSingle()
  if (existing.error) return { error: writeError(existing.error, "Could not save this purchase order.") }
  const denied = await guardWrite("purchase_orders", Boolean(existing.data))
  if (denied) return { error: denied }

  const order = await supabase
    .from("vendor_purchase_orders")
    .select("id, issued_on")
    .eq("id", input.purchaseOrderId)
    .maybeSingle()
  if (order.error || !order.data) return { error: "That purchase order could not be found." }

  const total = grandTotal(input.lines, "0", carrying)
  const body: Json = {
    vendorDetail: clip(input.vendorDetail, 500),
    site: clip(input.site, 200),
    receiver: clip(input.receiver, 120),
    deliveryOn: clip(input.deliveryOn, 10),
    carrying: String(carrying),
    terms: clip(input.terms, 2000),
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

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const documentNo = newDocumentNo("PO", order.data.issued_on.slice(0, 10))
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
  prefix: string,
  fallback: string,
): Promise<DocumentSaveResult> {
  const supabase = await createClient()
  const lines = storedLines(input.lines)
  const milestones = storedMilestones(input.milestones)
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const payload = input.id
      ? fields
      : { ...fields, document_no: newDocumentNo(prefix, input.issuedOn), verify_token: newToken() }
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
  projectId: string
  area: string
  subject: string
  terms: string
  exclusions: string
  aitPercent: string
  preparedBy: string
  authorizedBy: string
  lines: LineInput[]
  milestones: MilestoneInput[]
}): Promise<DocumentSaveResult> {
  if (!isIsoDate(input.issuedOn)) return { error: "Enter an issue date." }
  const validError = optionalDate(input.validUntil, "valid until date")
  if (validError) return { error: validError }
  if (!isQuotationStatus(input.status)) return { error: "Choose a status." }
  if (!isUuid(input.clientId)) return { error: "Choose a client." }
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

  const client = await supabase.from("clients").select("id").eq("id", input.clientId).maybeSingle()
  if (client.error || !client.data) return { error: "Choose a client." }
  if (input.projectId) {
    const project = await supabase
      .from("projects")
      .select("id, client_id")
      .eq("id", input.projectId)
      .maybeSingle()
    if (project.error || !project.data || project.data.client_id !== input.clientId) {
      return { error: "Choose a project for this client." }
    }
  }

  const total = grandTotal(input.lines, String(ait))
  const fields = {
    issued_on: input.issuedOn,
    valid_until: input.validUntil || null,
    status: input.status,
    client_id: input.clientId,
    project_id: input.projectId || null,
    area: clip(input.area, 120),
    subject: clip(input.subject, 300),
    terms: clip(input.terms, 4000),
    exclusions: clip(input.exclusions, 2000),
    ait_percent: ait,
    total,
    prepared_by: clip(input.preparedBy, 120),
    authorized_by: clip(input.authorizedBy, 120),
  }

  const saved = await saveDocumentAtomically("quotation", input, fields, "QTN", "Could not save this quotation.")
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
  proposalOn: string
  workStart: string
  workEnd: string
  subject: string
  introduction: string
  terms: string
  preparedBy: string
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
  if (!isUuid(input.vendorId)) return { error: "Choose a vendor." }
  if (input.projectId && !isUuid(input.projectId)) return { error: "Choose a project." }
  if (!input.lines.some((line) => line.item.trim())) return { error: "Add at least one item." }
  if (input.lines.some((line) => Number(line.unitPrice) < 0)) return { error: "Unit price can't be negative." }

  const supabase = await createClient()
  const denied = await guardWrite("work_orders", Boolean(input.id))
  if (denied) return { error: denied }
  if (input.id && !isUuid(input.id)) return { error: "That work order could not be found." }

  const vendor = await supabase.from("vendors").select("id").eq("id", input.vendorId).maybeSingle()
  if (vendor.error || !vendor.data) return { error: "Choose a vendor." }

  const total = priceLines(input.lines).subtotal
  const fields = {
    issued_on: input.issuedOn,
    status: input.status,
    vendor_id: input.vendorId,
    project_id: input.projectId || null,
    proposal_on: input.proposalOn || null,
    work_start: input.workStart || null,
    work_end: input.workEnd || null,
    subject: clip(input.subject, 300),
    introduction: clip(input.introduction, 2000),
    terms: clip(input.terms, 4000),
    total,
    prepared_by: clip(input.preparedBy, 120),
    authorized_by: clip(input.authorizedBy, 120),
  }

  const saved = await saveDocumentAtomically("work_order", input, fields, "WO", "Could not save this work order.")
  if (saved.error || !saved.id) return saved
  const id = saved.id
  revalidatePath("/documents/work-orders")
  revalidatePath(`/documents/work-orders/${id}`)
  return saved
}
