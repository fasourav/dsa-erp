"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import { resolveBankAccountId } from "@/lib/resolve-bank-account"
import {
  clientInvoiceStatusFromPayments,
  isClientInvoiceStatus,
  moneyCents,
  parsePositiveAmount,
  sumAmounts,
} from "@/lib/payment-status"
import { isIsoDate, parseProjectValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ClientInvoiceInput = {
  projectId: string
  issuedOn: string
  dueOn: string
  amount: string
  includeVat: boolean
  taxAmount: string
}

export type ClientInvoiceFieldErrors = {
  projectId?: string
  issuedOn?: string
  dueOn?: string
  amount?: string
  taxAmount?: string
}

export type ClientInvoiceResult = {
  error: string | null
  fieldErrors?: ClientInvoiceFieldErrors
}

export type ClientPaymentInput = {
  paidOn: string
  amount: string
  method: string
  reference: string
  notes: string
  remarks: string
  bankAccountId: string
  newAccountName: string
  newBankName: string
}

export type ClientPaymentFieldErrors = {
  paidOn?: string
  amount?: string
  bankAccountId?: string
}

export type ClientPaymentResult = {
  error: string | null
  fieldErrors?: ClientPaymentFieldErrors
}

export type DeleteResult = {
  error: string | null
}

export async function addClientInvoice(
  input: ClientInvoiceInput,
): Promise<ClientInvoiceResult> {
  return saveClientInvoice(null, input)
}

export async function updateClientInvoice(
  id: string,
  input: ClientInvoiceInput,
): Promise<ClientInvoiceResult> {
  if (!isUuid(id)) {
    return { error: "That invoice could not be found." }
  }

  return saveClientInvoice(id, input)
}

export async function deleteClientInvoice(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { error: "That invoice could not be found." }
  }

  const auth = await authorizedClient()
  if (auth.error || !auth.supabase) {
    return { error: auth.error }
  }

  const { data, error } = await auth.supabase
    .from("client_invoices")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return { error: "This invoice has payments and cannot be deleted." }
    }

    return { error: "Could not delete this invoice." }
  }

  if (!data || data.length === 0) {
    return { error: "That invoice could not be found." }
  }

  revalidateClientMoney()
  return { error: null }
}

export async function addClientPayment(
  clientInvoiceId: string,
  input: ClientPaymentInput,
): Promise<ClientPaymentResult> {
  if (!isUuid(clientInvoiceId)) {
    return { error: "That invoice could not be found." }
  }

  return saveClientPayment(null, clientInvoiceId, input)
}

export async function updateClientPayment(
  id: string,
  input: ClientPaymentInput,
): Promise<ClientPaymentResult> {
  if (!isUuid(id)) {
    return { error: "That payment could not be found." }
  }

  return saveClientPayment(id, null, input)
}

export async function deleteClientPayment(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { error: "That payment could not be found." }
  }

  const auth = await authorizedClient()
  if (auth.error || !auth.supabase) {
    return { error: auth.error }
  }

  const existing = await auth.supabase
    .from("client_payments")
    .select("id, client_invoice_id")
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
    .from("client_payments")
    .delete()
    .eq("id", id)
    .select("id")

  if (error || !data || data.length === 0) {
    return { error: "Could not delete this payment." }
  }

  return syncClientInvoiceStatus(auth.supabase, payment.client_invoice_id)
}

async function saveClientInvoice(
  id: string | null,
  input: ClientInvoiceInput,
): Promise<ClientInvoiceResult> {
  const projectId = input.projectId.trim()
  const issuedOn = input.issuedOn.trim()
  const dueOn = input.dueOn.trim()
  const amount = parseProjectValue(input.amount)
  const fieldErrors: ClientInvoiceFieldErrors = {}
  let tax = 0

  if (!isUuid(projectId)) {
    fieldErrors.projectId = "Choose a project."
  }

  if (!isIsoDate(issuedOn)) {
    fieldErrors.issuedOn = "Enter an issue date."
  }

  if (dueOn && !isIsoDate(dueOn)) {
    fieldErrors.dueOn = "Enter a due date."
  }

  if (amount === null || amount <= 0) {
    fieldErrors.amount = input.amount.trim()
      ? "Enter an amount greater than 0."
      : "Enter an amount."
  } else if (input.includeVat) {
    const parsedTax = parsePositiveAmount(input.taxAmount)
    if (parsedTax === null) {
      fieldErrors.taxAmount = input.taxAmount.trim()
        ? "Enter a tax amount greater than 0."
        : "Enter a tax amount."
    } else if (moneyCents(parsedTax) > moneyCents(amount)) {
      fieldErrors.taxAmount = "Tax amount cannot be more than the invoice total."
    } else {
      tax = parsedTax
    }
  }

  if (Object.keys(fieldErrors).length > 0 || amount === null || amount <= 0) {
    return { error: null, fieldErrors }
  }

  const auth = await authorizedClient()
  if (auth.error || !auth.supabase) {
    return { error: auth.error }
  }

  const supabase = auth.supabase
  const project = await supabase
    .from("projects")
    .select("id, client_id")
    .eq("id", projectId)
    .limit(1)

  if (project.error) {
    return { error: "Could not save this invoice." }
  }

  const projectRow = project.data?.[0]
  if (!projectRow) {
    return { error: null, fieldErrors: { projectId: "Choose a project." } }
  }

  if (id) {
    const existing = await supabase
      .from("client_invoices")
      .select("id, status")
      .eq("id", id)
      .limit(1)

    if (existing.error) {
      return { error: "Could not save this invoice." }
    }

    const existingRow = existing.data?.[0]
    if (!existingRow || !isClientInvoiceStatus(existingRow.status)) {
      return { error: "That invoice could not be found." }
    }
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

  const status = clientInvoiceStatusFromPayments(amount, paid)

  const values = {
    project_id: projectRow.id,
    client_id: projectRow.client_id,
    issued_on: issuedOn,
    due_on: dueOn || null,
    amount,
    status,
  }

  const { data, error } = id
    ? await supabase.from("client_invoices").update(values).eq("id", id).select("id")
    : await supabase.from("client_invoices").insert(values).select("id")

  if (error) {
    if (error.code === "23503") {
      return {
        error: null,
        fieldErrors: { projectId: "Choose a project." },
      }
    }

    if (error.code === "23514") {
      return {
        error: null,
        fieldErrors: { amount: "Enter an amount greater than 0." },
      }
    }

    return { error: "Could not save this invoice." }
  }

  const invoiceId = data?.[0]?.id
  if (!invoiceId) {
    return { error: "That invoice could not be found." }
  }

  const vatError = await syncCollectedVat(supabase, invoiceId, {
    include: input.includeVat && tax > 0,
    amount: tax,
    projectId: projectRow.id,
    paidOn: issuedOn,
  })
  if (vatError) {
    return { error: vatError }
  }

  revalidateClientMoney()
  return { error: null }
}

async function saveClientPayment(
  id: string | null,
  clientInvoiceId: string | null,
  input: ClientPaymentInput,
): Promise<ClientPaymentResult> {
  const paidOn = input.paidOn.trim()
  const amount = parsePositiveAmount(input.amount)
  const method = input.method.trim()
  const reference = input.reference.trim()
  const notes = input.notes.trim()
  const remarks = input.remarks.trim()
  const fieldErrors: ClientPaymentFieldErrors = {}

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
  let invoiceId = clientInvoiceId

  if (id) {
    const existing = await supabase
      .from("client_payments")
      .select("id, client_invoice_id")
      .eq("id", id)
      .limit(1)

    if (existing.error) {
      return { error: "Could not save this payment." }
    }

    if (!existing.data || existing.data.length === 0) {
      return { error: "That payment could not be found." }
    }

    invoiceId = existing.data[0]?.client_invoice_id ?? null
  }

  if (!invoiceId || !isUuid(invoiceId)) {
    return { error: "That invoice could not be found." }
  }

  const invoice = await supabase
    .from("client_invoices")
    .select("id, amount, status")
    .eq("id", invoiceId)
    .limit(1)

  if (invoice.error) {
    return { error: "Could not save this payment." }
  }

  const invoiceRow = invoice.data?.[0]
  if (!invoiceRow || !isClientInvoiceStatus(invoiceRow.status)) {
    return { error: "That invoice could not be found." }
  }

  const alreadyPaid = await paidForInvoice(supabase, invoiceId, id)
  if (alreadyPaid === null) {
    return { error: "Could not save this payment." }
  }

  const nextPaid = sumAmounts([alreadyPaid, amount])
  if (moneyCents(nextPaid) > moneyCents(invoiceRow.amount)) {
    return {
      error: null,
      fieldErrors: { amount: "Payment is more than the amount still due." },
    }
  }

  const bank = await resolveBankAccountId(supabase, input.bankAccountId, "", "")
  if (bank.fieldError) {
    return { error: null, fieldErrors: { bankAccountId: bank.fieldError } }
  }
  if (bank.error || !bank.id) {
    return { error: bank.error ?? "Could not save this payment." }
  }

  const values = {
    client_invoice_id: invoiceId,
    paid_on: paidOn,
    amount,
    method: method || null,
    reference: reference || null,
    notes: notes || null,
    remarks: remarks || null,
    bank_account_id: bank.id,
  }

  const { data, error } = id
    ? await supabase.from("client_payments").update(values).eq("id", id).select("id")
    : await supabase.from("client_payments").insert(values).select("id")

  if (error) {
    if (error.code === "23514") {
      return {
        error: null,
        fieldErrors: { amount: "Enter a payment greater than 0." },
      }
    }

    return { error: "Could not save this payment." }
  }

  const paymentId = data?.[0]?.id
  if (!paymentId) {
    return { error: "That payment could not be found." }
  }

  const paid = await paidForInvoice(supabase, invoiceId, null)
  if (paid === null) {
    return { error: "Could not update the invoice status." }
  }

  const nextStatus = clientInvoiceStatusFromPayments(invoiceRow.amount, paid)
  const statusUpdate = await supabase
    .from("client_invoices")
    .update({ status: nextStatus })
    .eq("id", invoiceId)

  if (statusUpdate.error) {
    return { error: "Could not update the invoice status." }
  }

  revalidateClientMoney()
  return { error: null }
}

async function syncClientInvoiceStatus(
  supabase: SupabaseClient,
  invoiceId: string,
): Promise<DeleteResult> {
  const invoice = await supabase
    .from("client_invoices")
    .select("id, amount, status")
    .eq("id", invoiceId)
    .limit(1)

  if (
    invoice.error ||
    !invoice.data?.[0] ||
    !isClientInvoiceStatus(invoice.data[0].status)
  ) {
    return { error: "Could not update the invoice status." }
  }

  const invoiceRow = invoice.data[0]
  const paid = await paidForInvoice(supabase, invoiceId, null)
  if (paid === null) {
    return { error: "Could not update the invoice status." }
  }

  const statusUpdate = await supabase
    .from("client_invoices")
    .update({
      status: clientInvoiceStatusFromPayments(invoiceRow.amount, paid),
    })
    .eq("id", invoiceId)

  if (statusUpdate.error) {
    return { error: "Could not update the invoice status." }
  }

  revalidateClientMoney()
  return { error: null }
}

async function paidForInvoice(
  supabase: SupabaseClient,
  invoiceId: string,
  exceptPaymentId: string | null,
): Promise<number | null> {
  const { data, error } = await supabase
    .from("client_payments")
    .select("id, amount")
    .eq("client_invoice_id", invoiceId)

  if (error || !data) {
    return null
  }

  return sumAmounts(
    data
      .filter((row) => row.id !== exceptPaymentId)
      .map((row) => Number(row.amount)),
  )
}

async function syncCollectedVat(
  supabase: SupabaseClient,
  invoiceId: string,
  input: {
    include: boolean
    amount: number
    projectId: string
    paidOn: string
  },
): Promise<string | null> {
  if (!input.include || input.amount <= 0) {
    const deleted = await supabase
      .from("vat_tax_payments")
      .delete()
      .eq("client_invoice_id", invoiceId)
      .eq("collected_on_invoice", true)

    return deleted.error ? "Could not update the linked VAT/Tax record." : null
  }

  const existing = await supabase
    .from("vat_tax_payments")
    .select("id")
    .eq("client_invoice_id", invoiceId)
    .limit(1)

  if (existing.error) {
    return "Could not update the linked VAT/Tax record."
  }

  const values = {
    project_id: input.projectId,
    paid_on: input.paidOn,
    amount: input.amount,
    payment_method: null,
    notes: "Collected on client invoice",
    bank_account_id: null,
    client_invoice_id: invoiceId,
    collected_on_invoice: true,
  }

  const saved = existing.data?.[0]
    ? await supabase
        .from("vat_tax_payments")
        .update(values)
        .eq("id", existing.data[0].id)
        .select("id")
    : await supabase.from("vat_tax_payments").insert(values).select("id")

  if (saved.error || !saved.data?.length) {
    return "Could not save the linked VAT/Tax record."
  }

  return null
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

function revalidateClientMoney() {
  revalidatePath("/accounts/invoices")
  revalidatePath("/accounts/receivable")
  revalidatePath("/accounts/bank")
  revalidatePath("/accounts/vat-tax")
  revalidatePath("/projects")
  revalidatePath("/projects/[id]", "page")
  revalidatePath("/clients")
  revalidatePath("/dashboard")
  revalidatePath("/income")
}
