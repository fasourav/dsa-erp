"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import {
  clientInvoiceStatusFromPayments,
  isClientInvoicePaid,
  isClientInvoiceStatus,
  moneyCents,
  parsePositiveAmount,
  sumAmounts,
  type ClientInvoiceStatus,
} from "@/lib/payment-status"
import { isIsoDate, parseProjectValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export type ClientInvoiceInput = {
  projectId: string
  issuedOn: string
  amount: string
  status: string
}

export type ClientInvoiceFieldErrors = {
  projectId?: string
  issuedOn?: string
  amount?: string
  status?: string
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
}

export type ClientPaymentFieldErrors = {
  paidOn?: string
  amount?: string
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
  const amount = parseProjectValue(input.amount)
  const status = input.status.trim()
  const fieldErrors: ClientInvoiceFieldErrors = {}

  if (!isUuid(projectId)) {
    fieldErrors.projectId = "Choose a project."
  }

  if (!isIsoDate(issuedOn)) {
    fieldErrors.issuedOn = "Enter an issue date."
  }

  if (amount === null || amount <= 0) {
    fieldErrors.amount = input.amount.trim()
      ? "Enter an amount greater than 0."
      : "Enter an amount."
  }

  if (!isClientInvoiceStatus(status)) {
    fieldErrors.status = "Choose a status."
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    amount === null ||
    amount <= 0 ||
    !isClientInvoiceStatus(status)
  ) {
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

  let previous: {
    project_id: string
    client_id: string
    issued_on: string
    amount: number
    status: ClientInvoiceStatus
  } | null = null

  if (id) {
    const existing = await supabase
      .from("client_invoices")
      .select("id, project_id, client_id, issued_on, amount, status")
      .eq("id", id)
      .limit(1)

    if (existing.error) {
      return { error: "Could not save this invoice." }
    }

    const existingRow = existing.data?.[0]
    if (!existingRow || !isClientInvoiceStatus(existingRow.status)) {
      return { error: "That invoice could not be found." }
    }

    previous = {
      project_id: existingRow.project_id,
      client_id: existingRow.client_id,
      issued_on: existingRow.issued_on,
      amount: existingRow.amount,
      status: existingRow.status,
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

  if (!isClientInvoicePaid(status) && moneyCents(paid) > 0) {
    return {
      error: null,
      fieldErrors: {
        status: "Payments are already recorded for this invoice.",
      },
    }
  }

  const values = {
    project_id: projectRow.id,
    client_id: projectRow.client_id,
    issued_on: issuedOn,
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

  const savedId = data?.[0]?.id
  if (!savedId) {
    return { error: "That invoice could not be found." }
  }

  if (isClientInvoicePaid(status)) {
    const remainingCents = moneyCents(amount) - moneyCents(paid)
    if (remainingCents > 0) {
      const payment = await supabase
        .from("client_payments")
        .insert({
          client_invoice_id: savedId,
          paid_on: issuedOn,
          amount: remainingCents / 100,
        })
        .select("id")

      if (payment.error || !payment.data || payment.data.length === 0) {
        if (id && previous) {
          await supabase
            .from("client_invoices")
            .update({
              project_id: previous.project_id,
              client_id: previous.client_id,
              issued_on: previous.issued_on,
              amount: previous.amount,
              status: previous.status,
            })
            .eq("id", id)
        } else {
          await supabase.from("client_invoices").delete().eq("id", savedId)
        }

        return { error: "Could not record the invoice payment." }
      }
    }
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

  const values = {
    client_invoice_id: invoiceId,
    paid_on: paidOn,
    amount,
    method: method || null,
    reference: reference || null,
    notes: notes || null,
    remarks: remarks || null,
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

  if (!data || data.length === 0) {
    return { error: "That payment could not be found." }
  }

  const nextStatus = clientInvoiceStatusFromPayments(invoiceRow.amount, nextPaid)
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

function revalidateClientMoney() {
  revalidatePath("/accounts/invoices")
  revalidatePath("/accounts/receivable")
  revalidatePath("/projects")
  revalidatePath("/clients")
}
