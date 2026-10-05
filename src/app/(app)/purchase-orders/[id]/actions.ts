"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import {
  derivePaymentStatus,
  isPaymentStatus,
  moneyCents,
  parsePositiveAmount,
  statusMatchesPayments,
  sumAmounts,
  type PaymentStatus,
} from "@/lib/payment-status"
import { isIsoDate, parseProjectValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type VendorInvoiceInput = {
  issuedOn: string
  dueOn: string
  amount: string
  status: string
  description: string
}

export type VendorInvoiceFieldErrors = {
  issuedOn?: string
  dueOn?: string
  amount?: string
  status?: string
}

export type VendorInvoiceResult = {
  error: string | null
  fieldErrors?: VendorInvoiceFieldErrors
}

export type VendorPaymentInput = {
  paidOn: string
  amount: string
  method: string
  reference: string
  notes: string
  expenseCategory: string
}

export type VendorPaymentFieldErrors = {
  paidOn?: string
  amount?: string
}

export type VendorPaymentResult = {
  error: string | null
  fieldErrors?: VendorPaymentFieldErrors
}

export type DeleteResult = {
  error: string | null
}

export async function addVendorInvoice(
  purchaseOrderId: string,
  input: VendorInvoiceInput,
): Promise<VendorInvoiceResult> {
  if (!isUuid(purchaseOrderId)) {
    return { error: "That purchase order could not be found." }
  }

  return saveVendorInvoice(null, purchaseOrderId, input)
}

export async function updateVendorInvoice(
  id: string,
  input: VendorInvoiceInput,
): Promise<VendorInvoiceResult> {
  if (!isUuid(id)) {
    return { error: "That invoice could not be found." }
  }

  return saveVendorInvoice(id, null, input)
}

export async function deleteVendorInvoice(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { error: "That invoice could not be found." }
  }

  const auth = await authorizedClient()
  if (auth.error || !auth.supabase) {
    return { error: auth.error }
  }

  const { data, error } = await auth.supabase
    .from("vendor_invoices")
    .delete()
    .eq("id", id)
    .select("id, purchase_order_id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return {
        error: "This invoice has payments and cannot be deleted.",
      }
    }

    return { error: "Could not delete this invoice." }
  }

  if (!data || data.length === 0) {
    return { error: "That invoice could not be found." }
  }

  revalidateVendorMoney(data[0]?.purchase_order_id ?? null)
  return { error: null }
}

export async function addVendorPayment(
  vendorInvoiceId: string,
  input: VendorPaymentInput,
): Promise<VendorPaymentResult> {
  if (!isUuid(vendorInvoiceId)) {
    return { error: "That invoice could not be found." }
  }

  return saveVendorPayment(null, vendorInvoiceId, input)
}

export async function updateVendorPayment(
  id: string,
  input: VendorPaymentInput,
): Promise<VendorPaymentResult> {
  if (!isUuid(id)) {
    return { error: "That payment could not be found." }
  }

  return saveVendorPayment(id, null, input)
}

export async function deleteVendorPayment(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { error: "That payment could not be found." }
  }

  const auth = await authorizedClient()
  if (auth.error || !auth.supabase) {
    return { error: auth.error }
  }

  const existing = await auth.supabase
    .from("vendor_payments")
    .select("id, vendor_invoice_id")
    .eq("id", id)
    .limit(1)

  if (existing.error) {
    return { error: "Could not delete this payment." }
  }

  const payment = existing.data?.[0]
  if (!payment) {
    return { error: "That payment could not be found." }
  }

  const { data, error } = await auth.supabase
    .from("vendor_payments")
    .delete()
    .eq("id", id)
    .select("id")

  if (error || !data || data.length === 0) {
    return { error: "Could not delete this payment." }
  }

  const synced = await syncVendorInvoiceStatus(
    auth.supabase,
    payment.vendor_invoice_id,
  )
  if (synced.error) {
    return synced
  }

  return { error: null }
}

async function saveVendorInvoice(
  id: string | null,
  purchaseOrderId: string | null,
  input: VendorInvoiceInput,
): Promise<VendorInvoiceResult> {
  const issuedOn = input.issuedOn.trim()
  const dueOn = input.dueOn.trim()
  const description = input.description.trim()
  const amount = parseProjectValue(input.amount)
  const status = input.status.trim()
  const fieldErrors: VendorInvoiceFieldErrors = {}

  if (!isIsoDate(issuedOn)) {
    fieldErrors.issuedOn = "Enter an issued date."
  }

  if (dueOn && !isIsoDate(dueOn)) {
    fieldErrors.dueOn = "Enter a due date."
  }

  if (amount === null) {
    fieldErrors.amount = input.amount.trim()
      ? "Enter an amount of 0 or more."
      : "Enter an amount."
  }

  if (!isPaymentStatus(status)) {
    fieldErrors.status = "Choose a status."
  }

  if (Object.keys(fieldErrors).length > 0 || amount === null || !isPaymentStatus(status)) {
    return { error: null, fieldErrors }
  }

  const auth = await authorizedClient()
  if (auth.error || !auth.supabase) {
    return { error: auth.error }
  }

  const supabase = auth.supabase
  let orderId = purchaseOrderId

  if (id) {
    const existing = await supabase
      .from("vendor_invoices")
      .select("id, purchase_order_id")
      .eq("id", id)
      .limit(1)

    if (existing.error) {
      return { error: "Could not save this invoice." }
    }

    if (!existing.data || existing.data.length === 0) {
      return { error: "That invoice could not be found." }
    }

    orderId = existing.data[0]?.purchase_order_id ?? null
  }

  if (!orderId || !isUuid(orderId)) {
    return { error: "That purchase order could not be found." }
  }

  const order = await supabase
    .from("vendor_purchase_orders")
    .select("id")
    .eq("id", orderId)
    .limit(1)

  if (order.error) {
    return { error: "Could not save this invoice." }
  }

  if (!order.data || order.data.length === 0) {
    return { error: "That purchase order could not be found." }
  }

  const paid = id ? await paidForInvoice(supabase, id, null) : 0
  if (paid === null) {
    return { error: "Could not save this invoice." }
  }

  if (moneyCents(amount) < moneyCents(paid)) {
    return {
      error: null,
      fieldErrors: {
        amount: "Amount is less than payments already recorded.",
      },
    }
  }

  if (!statusMatchesPayments(status, amount, paid)) {
    return {
      error: null,
      fieldErrors: {
        status: "Status does not match recorded payments. Choose Void to set the invoice aside.",
      },
    }
  }

  const values = {
    purchase_order_id: orderId,
    issued_on: issuedOn,
    due_on: dueOn || null,
    amount,
    status,
    description: description || null,
  }

  const { data, error } = id
    ? await supabase
        .from("vendor_invoices")
        .update(values)
        .eq("id", id)
        .select("id")
    : await supabase.from("vendor_invoices").insert(values).select("id")

  if (error) {
    if (error.code === "23503") {
      return { error: "That purchase order could not be found." }
    }

    if (error.code === "23514") {
      return {
        error: null,
        fieldErrors: { amount: "Enter an amount of 0 or more." },
      }
    }

    return { error: "Could not save this invoice." }
  }

  if (!data || data.length === 0) {
    return { error: "That invoice could not be found." }
  }

  revalidateVendorMoney(orderId)
  return { error: null }
}

async function saveVendorPayment(
  id: string | null,
  vendorInvoiceId: string | null,
  input: VendorPaymentInput,
): Promise<VendorPaymentResult> {
  const paidOn = input.paidOn.trim()
  const amount = parsePositiveAmount(input.amount)
  const method = input.method.trim()
  const reference = input.reference.trim()
  const notes = input.notes.trim()
  const expenseCategory = input.expenseCategory.trim()
  const fieldErrors: VendorPaymentFieldErrors = {}

  if (!isIsoDate(paidOn)) {
    fieldErrors.paidOn = "Enter a payment date."
  }

  if (amount === null) {
    fieldErrors.amount = input.amount.trim()
      ? "Enter a payment greater than 0."
      : "Enter a payment amount."
  }

  if (Object.keys(fieldErrors).length > 0 || amount === null) {
    return { error: null, fieldErrors }
  }

  const auth = await authorizedClient()
  if (auth.error || !auth.supabase) {
    return { error: auth.error }
  }

  const supabase = auth.supabase
  let invoiceId = vendorInvoiceId

  if (id) {
    const existing = await supabase
      .from("vendor_payments")
      .select("id, vendor_invoice_id")
      .eq("id", id)
      .limit(1)

    if (existing.error) {
      return { error: "Could not save this payment." }
    }

    if (!existing.data || existing.data.length === 0) {
      return { error: "That payment could not be found." }
    }

    invoiceId = existing.data[0]?.vendor_invoice_id ?? null
  }

  if (!invoiceId || !isUuid(invoiceId)) {
    return { error: "That invoice could not be found." }
  }

  const invoice = await supabase
    .from("vendor_invoices")
    .select("id, amount, status, purchase_order_id")
    .eq("id", invoiceId)
    .limit(1)

  if (invoice.error) {
    return { error: "Could not save this payment." }
  }

  const invoiceRow = invoice.data?.[0]
  if (!invoiceRow || !isPaymentStatus(invoiceRow.status)) {
    return { error: "That invoice could not be found." }
  }

  if (!id && invoiceRow.status === "void") {
    return { error: "This invoice is void." }
  }

  const alreadyPaid = await paidForInvoice(supabase, invoiceId, id)
  if (alreadyPaid === null) {
    return { error: "Could not save this payment." }
  }

  const nextPaid = sumAmounts([alreadyPaid, amount])
  if (moneyCents(nextPaid) > moneyCents(invoiceRow.amount)) {
    return {
      error: null,
      fieldErrors: {
        amount: "Payment is more than the amount still due.",
      },
    }
  }

  const values = {
    vendor_invoice_id: invoiceId,
    paid_on: paidOn,
    amount,
    method: method || null,
    reference: reference || null,
    notes: notes || null,
    expense_category: expenseCategory || null,
  }

  const { data, error } = id
    ? await supabase.from("vendor_payments").update(values).eq("id", id).select("id")
    : await supabase.from("vendor_payments").insert(values).select("id")

  if (error) {
    if (error.code === "23514") {
      return {
        error: null,
        fieldErrors: { amount: "Enter a payment greater than 0." },
      }
    }

    return { error: "Could not save this payment." }
  }

  if (!data || data.length === 0) {
    return { error: "That payment could not be found." }
  }

  if (invoiceRow.status !== "void") {
    const nextStatus = derivePaymentStatus(invoiceRow.amount, nextPaid)
    const statusUpdate = await supabase
      .from("vendor_invoices")
      .update({ status: nextStatus satisfies PaymentStatus })
      .eq("id", invoiceId)

    if (statusUpdate.error) {
      return { error: "Could not update the invoice status." }
    }
  }

  revalidateVendorMoney(invoiceRow.purchase_order_id)
  return { error: null }
}

async function syncVendorInvoiceStatus(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<DeleteResult> {
  const invoice = await supabase
    .from("vendor_invoices")
    .select("id, amount, status, purchase_order_id")
    .eq("id", invoiceId)
    .limit(1)

  if (invoice.error || !invoice.data || invoice.data.length === 0) {
    return { error: "Could not update the invoice status." }
  }

  const invoiceRow = invoice.data[0]
  if (!invoiceRow || !isPaymentStatus(invoiceRow.status)) {
    return { error: "Could not update the invoice status." }
  }

  if (invoiceRow.status !== "void") {
    const paid = await paidForInvoice(supabase, invoiceId, null)
    if (paid === null) {
      return { error: "Could not update the invoice status." }
    }

    const status = derivePaymentStatus(invoiceRow.amount, paid)
    const statusUpdate = await supabase
      .from("vendor_invoices")
      .update({ status })
      .eq("id", invoiceId)

    if (statusUpdate.error) {
      return { error: "Could not update the invoice status." }
    }
  }

  revalidateVendorMoney(invoiceRow.purchase_order_id)
  return { error: null }
}

async function paidForInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  exceptPaymentId: string | null,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("vendor_payments")
    .select("id, amount")
    .eq("vendor_invoice_id", invoiceId)

  if (error || !data) {
    return null
  }

  return sumAmounts(
    data.flatMap((row) =>
      row.id === exceptPaymentId ? [] : [Number(row.amount)],
    ),
  )
}

async function authorizedClient(): Promise<{
  supabase: SupabaseClient | null
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return { supabase: null, error: "You must be signed in." }
  }

  return { supabase, error: null }
}

function revalidateVendorMoney(purchaseOrderId: string | null) {
  revalidatePath("/purchase-orders")
  if (purchaseOrderId) {
    revalidatePath(`/purchase-orders/${purchaseOrderId}`)
  }
  revalidatePath("/accounts/payable")
  revalidatePath("/vendors")
  revalidatePath("/projects")
}
