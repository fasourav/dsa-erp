"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import { isIsoDate, parseProjectValue } from "@/lib/project-validation"
import { resolveBankAccountId } from "@/lib/resolve-bank-account"
import { createClient } from "@/lib/supabase/server"

export type VatTaxInput = {
  projectId: string
  paidOn: string
  amount: string
  paymentMethod: string
  notes: string
  bankAccountId: string
  newAccountName: string
  newBankName: string
}

export type VatTaxFieldErrors = {
  projectId?: string
  paidOn?: string
  amount?: string
  bankAccountId?: string
}

export type VatTaxResult = {
  error: string | null
  fieldErrors?: VatTaxFieldErrors
}

export type DeleteResult = {
  error: string | null
}

export async function addVatTaxPayment(
  input: VatTaxInput,
): Promise<VatTaxResult> {
  const projectId = input.projectId.trim()
  const paidOn = input.paidOn.trim()
  const amount = parseProjectValue(input.amount)
  const paymentMethod = input.paymentMethod.trim()
  const notes = input.notes.trim()
  const fieldErrors: VatTaxFieldErrors = {}

  if (!isUuid(projectId)) fieldErrors.projectId = "Choose a project."
  if (!isIsoDate(paidOn)) fieldErrors.paidOn = "Enter a date."
  if (amount === null || amount <= 0)
    fieldErrors.amount = input.amount.trim()
      ? "Enter an amount greater than 0."
      : "Enter an amount."

  if (Object.keys(fieldErrors).length > 0 || amount === null || amount <= 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const bank = await resolveBankAccountId(supabase, input.bankAccountId, "", "")
  if (bank.fieldError) {
    return { error: null, fieldErrors: { bankAccountId: bank.fieldError } }
  }
  if (bank.error || !bank.id) {
    return { error: bank.error ?? "Could not save this payment." }
  }

  const values = {
    project_id: projectId,
    paid_on: paidOn,
    amount,
    payment_method: paymentMethod || null,
    notes: notes || null,
    bank_account_id: bank.id,
  }

  const { data, error } = await supabase
    .from("vat_tax_payments")
    .insert(values)
    .select("id")

  if (error) {
    if (error.code === "23503") return { error: "Choose a valid project." }
    return { error: "Could not save this payment." }
  }
  if (!data || data.length === 0)
    return { error: "Could not save this payment." }

  revalidateVatTax()
  return { error: null }
}

export async function deleteVatTaxPayment(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { error: "That payment could not be found." }
  }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const { data, error } = await supabase
    .from("vat_tax_payments")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) return { error: vatDeleteMessage(error) }
  if (!data || data.length === 0) {
    return { error: "That payment could not be found." }
  }

  revalidateVatTax()
  return { error: null }
}

function vatDeleteMessage(error: { code?: string; message: string }): string {
  const message = error.message ?? ""
  if (error.code === "23503" || /foreign key/i.test(message)) {
    return "This payment is used elsewhere and cannot be deleted."
  }
  if (
    error.code === "42501" ||
    /row-level security|permission denied/i.test(message)
  ) {
    return "You do not have permission to delete this payment."
  }
  return "Could not delete this payment."
}

function revalidateVatTax() {
  revalidatePath("/accounts/vat-tax")
  revalidatePath("/accounts/bank")
  revalidatePath("/dashboard")
  revalidatePath("/projects")
  revalidatePath("/projects/[id]", "page")
}
