"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import { resolveBankAccountId } from "@/lib/resolve-bank-account"
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
  bankAccountId: string
  newAccountName: string
  newBankName: string
}

export type VendorPaymentFieldErrors = {
  paidOn?: string
  amount?: string
  bankAccountId?: string
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
    return { error: "That payment could not be found." }
  }

  return saveVendorInvoice(id, null, input)
}

export async function deleteVendorInvoice(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { error: "That payment could not be found." }
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
        error: "Remove recorded payments before deleting this.",
      }
    }

    return { error: "Could not delete this payment." }
  }

  if (!data || data.length === 0) {
    return { error: "That payment could not be found." }
  }

  revalidateVendorMoney(data[0]?.purchase_order_id ?? null)
  return { error: null }
}

export async function addVendorPayment(
  vendorInvoiceId: string,
  input: VendorPaymentInput,
): Promise<VendorPaymentResult> {
  if (!isUuid(vendorInvoiceId)) {
    return { error: "That payment could not be found." }
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

export type RecordVendorPaymentInput = {
  paidOn: string
  amount: string
  method: string
  notes: string
  bankAccountId: string
  newAccountName: string
  newBankName: string
  separateInvoice: boolean
  invoiceIssuedOn: string
  invoiceDueOn: string
  invoiceAmount: string
}

export type RecordVendorPaymentFieldErrors = VendorPaymentFieldErrors & {
  invoiceIssuedOn?: string
  invoiceDueOn?: string
  invoiceAmount?: string
}

export type RecordVendorPaymentResult = {
  error: string | null
  fieldErrors?: RecordVendorPaymentFieldErrors
}

export async function recordPurchaseOrderPayment(
  purchaseOrderId: string,
  input: RecordVendorPaymentInput,
): Promise<RecordVendorPaymentResult> {
  if (!isUuid(purchaseOrderId)) {
    return { error: "That purchase order could not be found." }
  }

  const paidOn = input.paidOn.trim()
  const amount = parsePositiveAmount(input.amount)
  const fieldErrors: RecordVendorPaymentFieldErrors = {}

  if (!isIsoDate(paidOn)) {
    fieldErrors.paidOn = "Enter a payment date."
  }

  if (amount === null) {
    fieldErrors.amount = input.amount.trim()
      ? "Enter a payment greater than 0."
      : "Enter a payment amount."
  }

  let invoiceAmount: number | null = null
  if (input.separateInvoice) {
    const issuedOn = input.invoiceIssuedOn.trim()
    const dueOn = input.invoiceDueOn.trim()
    invoiceAmount = parseProjectValue(input.invoiceAmount)

    if (!isIsoDate(issuedOn)) {
      fieldErrors.invoiceIssuedOn = "Enter an issue date."
    }

    if (dueOn && !isIsoDate(dueOn)) {
      fieldErrors.invoiceDueOn = "Enter a due date."
    }

    if (invoiceAmount === null) {
      fieldErrors.invoiceAmount = input.invoiceAmount.trim()
        ? "Enter an amount of 0 or more."
        : "Enter an invoice amount."
    } else if (
      amount !== null &&
      moneyCents(invoiceAmount) < moneyCents(amount)
    ) {
      fieldErrors.invoiceAmount = "Invoice amount must cover this payment."
    }
  }

  if (Object.keys(fieldErrors).length > 0 || amount === null) {
    return { error: null, fieldErrors }
  }

  const auth = await authorizedClient()
  if (auth.error || !auth.supabase) {
    return { error: auth.error }
  }

  const supabase = auth.supabase
  const order = await supabase
    .from("vendor_purchase_orders")
    .select("id, total_value")
    .eq("id", purchaseOrderId)
    .limit(1)

  if (order.error) {
    return { error: "Could not save this payment." }
  }

  const purchaseOrder = order.data?.[0]
  if (!purchaseOrder) {
    return { error: "That purchase order could not be found." }
  }

  const paymentInput: VendorPaymentInput = {
    paidOn,
    amount: input.amount,
    method: input.method,
    reference: "",
    notes: input.notes,
    expenseCategory: "",
    bankAccountId: input.bankAccountId,
    newAccountName: input.newAccountName,
    newBankName: input.newBankName,
  }

  if (input.separateInvoice && invoiceAmount !== null) {
    return payAgainstNewInvoice(supabase, purchaseOrderId, {
      issuedOn: input.invoiceIssuedOn.trim(),
      dueOn: input.invoiceDueOn.trim(),
      amount: invoiceAmount,
      payment: paymentInput,
    })
  }

  const target = await findOrPlanVendorInvoice(
    supabase,
    purchaseOrderId,
    Number(purchaseOrder.total_value),
    amount,
  )
  if (target.error) {
    return { error: target.error }
  }
  if (target.fieldErrors) {
    return { error: null, fieldErrors: target.fieldErrors }
  }
  if (target.invoiceId) {
    return saveVendorPayment(null, target.invoiceId, paymentInput)
  }

  return payAgainstNewInvoice(supabase, purchaseOrderId, {
    issuedOn: paidOn,
    dueOn: "",
    amount: target.createAmount ?? amount,
    payment: paymentInput,
  })
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
      return { error: "Could not save this payment." }
    }

    if (!existing.data || existing.data.length === 0) {
      return { error: "That payment could not be found." }
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
    return { error: "Could not save this payment." }
  }

  if (!order.data || order.data.length === 0) {
    return { error: "That purchase order could not be found." }
  }

  const paid = id ? await paidForInvoice(supabase, id, null) : 0
  if (paid === null) {
    return { error: "Could not save this payment." }
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
        status: "Status does not match recorded payments. Choose Void to set this payment aside.",
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

    return { error: "Could not save this payment." }
  }

  if (!data || data.length === 0) {
    return { error: "That payment could not be found." }
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
    return { error: "That payment could not be found." }
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
    return { error: "That payment could not be found." }
  }

  if (!id && invoiceRow.status === "void") {
    return { error: "This payment is void." }
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

  const bank = await resolveBankAccountId(
    supabase,
    input.bankAccountId,
    input.newAccountName,
    input.newBankName,
  )
  if (bank.fieldError) {
    return { error: null, fieldErrors: { bankAccountId: bank.fieldError } }
  }
  if (bank.error || !bank.id) {
    return { error: bank.error ?? "Could not save this payment." }
  }

  const values = {
    vendor_invoice_id: invoiceId,
    paid_on: paidOn,
    amount,
    method: method || null,
    reference: reference || null,
    notes: notes || null,
    expense_category: expenseCategory || null,
    bank_account_id: bank.id,
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
      return { error: "Could not update the payment status." }
    }
  }

  revalidateVendorMoney(invoiceRow.purchase_order_id)
  return { error: null }
}

async function findOrPlanVendorInvoice(
  supabase: SupabaseClient,
  purchaseOrderId: string,
  totalValue: number,
  amount: number,
): Promise<{
  invoiceId?: string
  createAmount?: number
  error?: string
  fieldErrors?: RecordVendorPaymentFieldErrors
}> {
  const invoices = await supabase
    .from("vendor_invoices")
    .select("id, amount, status, issued_on")
    .eq("purchase_order_id", purchaseOrderId)
    .order("issued_on", { ascending: true })
    .order("id", { ascending: true })

  if (invoices.error || !invoices.data) {
    return { error: "Could not save this payment." }
  }

  const invoiceIds = invoices.data.map((row) => row.id)
  const payments =
    invoiceIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from("vendor_payments")
          .select("vendor_invoice_id, amount")
          .in("vendor_invoice_id", invoiceIds)

  if (payments.error || !payments.data) {
    return { error: "Could not save this payment." }
  }

  const paidByInvoice = new Map<string, number>()
  for (const row of payments.data) {
    const current = paidByInvoice.get(row.vendor_invoice_id) ?? 0
    paidByInvoice.set(
      row.vendor_invoice_id,
      sumAmounts([current, Number(row.amount)]),
    )
  }

  const amountCents = moneyCents(amount)
  for (const invoice of invoices.data) {
    if (invoice.status === "void") {
      continue
    }

    const paid = paidByInvoice.get(invoice.id) ?? 0
    const balanceCents = moneyCents(Number(invoice.amount)) - moneyCents(paid)
    if (balanceCents >= amountCents) {
      return { invoiceId: invoice.id }
    }
  }

  const totalPaid = sumAmounts(payments.data.map((row) => Number(row.amount)))
  const pendingCents = Math.max(0, moneyCents(totalValue) - moneyCents(totalPaid))
  if (amountCents > pendingCents) {
    return {
      fieldErrors: { amount: "Payment is more than the amount still due." },
    }
  }

  return { createAmount: amount }
}

async function payAgainstNewInvoice(
  supabase: SupabaseClient,
  purchaseOrderId: string,
  input: {
    issuedOn: string
    dueOn: string
    amount: number
    payment: VendorPaymentInput
  },
): Promise<RecordVendorPaymentResult> {
  const created = await supabase
    .from("vendor_invoices")
    .insert({
      purchase_order_id: purchaseOrderId,
      issued_on: input.issuedOn,
      due_on: input.dueOn || null,
      amount: input.amount,
      status: "unpaid",
      description: null,
    })
    .select("id")

  if (created.error || !created.data?.[0]) {
    return { error: "Could not save this payment." }
  }

  const invoiceId = created.data[0].id
  const result = await saveVendorPayment(null, invoiceId, input.payment)
  if (result.error || result.fieldErrors) {
    const existing = await supabase
      .from("vendor_payments")
      .select("id")
      .eq("vendor_invoice_id", invoiceId)
      .limit(1)

    if (!existing.error && (!existing.data || existing.data.length === 0)) {
      await supabase.from("vendor_invoices").delete().eq("id", invoiceId)
    }
  }

  return result
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
    return { error: "Could not update the payment status." }
  }

  const invoiceRow = invoice.data[0]
  if (!invoiceRow || !isPaymentStatus(invoiceRow.status)) {
    return { error: "Could not update the payment status." }
  }

  if (invoiceRow.status !== "void") {
    const paid = await paidForInvoice(supabase, invoiceId, null)
    if (paid === null) {
      return { error: "Could not update the payment status." }
    }

    const status = derivePaymentStatus(invoiceRow.amount, paid)
    const statusUpdate = await supabase
      .from("vendor_invoices")
      .update({ status })
      .eq("id", invoiceId)

    if (statusUpdate.error) {
      return { error: "Could not update the payment status." }
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
  revalidatePath("/accounts/bank")
  revalidatePath("/vendors")
  revalidatePath("/projects")
}
