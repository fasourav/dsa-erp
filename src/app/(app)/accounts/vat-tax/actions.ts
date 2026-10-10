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

  revalidatePath("/accounts/vat-tax")
  revalidatePath("/accounts/bank")
  return { error: null }
}
