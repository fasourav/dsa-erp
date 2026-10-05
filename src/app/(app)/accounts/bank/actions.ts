"use server"

import { revalidatePath } from "next/cache"

import {
  isBankDirection,
  isBankSourceKind,
} from "@/lib/bank"
import { isUuid } from "@/lib/ids"
import { isIsoDate } from "@/lib/project-validation"
import { parsePositiveAmount } from "@/lib/payment-status"
import { createClient } from "@/lib/supabase/server"

export type BankAccountInput = {
  name: string
  bankName: string
  currency: string
  isActive: boolean
}

export type BankAccountFieldErrors = {
  name?: string
  currency?: string
}

export type BankAccountResult = {
  error: string | null
  fieldErrors?: BankAccountFieldErrors
}

export type BankTransactionInput = {
  bankAccountId: string
  transactionDate: string
  direction: string
  amount: string
  sourceKind: string
  paymentMethod: string
  projectId: string
  notes: string
}

export type BankTransactionFieldErrors = {
  bankAccountId?: string
  transactionDate?: string
  direction?: string
  amount?: string
  sourceKind?: string
  projectId?: string
}

export type BankTransactionResult = {
  error: string | null
  fieldErrors?: BankTransactionFieldErrors
}

export type DeleteResult = {
  error: string | null
}

export async function addBankAccount(
  input: BankAccountInput,
): Promise<BankAccountResult> {
  return saveBankAccount(null, input)
}

export async function updateBankAccount(
  id: string,
  input: BankAccountInput,
): Promise<BankAccountResult> {
  if (!isUuid(id)) {
    return { error: "That bank account could not be found." }
  }

  return saveBankAccount(id, input)
}

export async function deleteBankAccount(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { error: "That bank account could not be found." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("bank_accounts")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return {
        error: "This account has transactions and cannot be deleted.",
      }
    }

    return { error: "Could not delete this bank account." }
  }

  if (!data || data.length === 0) {
    return { error: "That bank account could not be found." }
  }

  revalidatePath("/accounts/bank")
  return { error: null }
}

export async function addBankTransaction(
  input: BankTransactionInput,
): Promise<BankTransactionResult> {
  return saveBankTransaction(null, input)
}

export async function updateBankTransaction(
  id: string,
  input: BankTransactionInput,
): Promise<BankTransactionResult> {
  if (!isUuid(id)) {
    return { error: "That transaction could not be found." }
  }

  return saveBankTransaction(id, input)
}

export async function deleteBankTransaction(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { error: "That transaction could not be found." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("bank_transactions")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    return { error: "Could not delete this transaction." }
  }

  if (!data || data.length === 0) {
    return { error: "That transaction could not be found." }
  }

  revalidatePath("/accounts/bank")
  return { error: null }
}

async function saveBankAccount(
  id: string | null,
  input: BankAccountInput,
): Promise<BankAccountResult> {
  const name = input.name.trim()
  const bankName = input.bankName.trim()
  const currency = input.currency.trim()
  const fieldErrors: BankAccountFieldErrors = {}

  if (!name) {
    fieldErrors.name = "Enter an account name."
  }

  if (!currency) {
    fieldErrors.currency = "Enter a currency."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const values = {
    name,
    bank_name: bankName || null,
    currency,
    is_active: input.isActive,
  }

  const { data, error } = id
    ? await supabase.from("bank_accounts").update(values).eq("id", id).select("id")
    : await supabase.from("bank_accounts").insert(values).select("id")

  if (error) {
    return { error: "Could not save this bank account." }
  }

  if (!data || data.length === 0) {
    return { error: "That bank account could not be found." }
  }

  revalidatePath("/accounts/bank")
  return { error: null }
}

async function saveBankTransaction(
  id: string | null,
  input: BankTransactionInput,
): Promise<BankTransactionResult> {
  const bankAccountId = input.bankAccountId.trim()
  const transactionDate = input.transactionDate.trim()
  const direction = input.direction.trim()
  const sourceKind = input.sourceKind.trim()
  const paymentMethod = input.paymentMethod.trim()
  const projectId = input.projectId.trim()
  const notes = input.notes.trim()
  const amount = parsePositiveAmount(input.amount)
  const fieldErrors: BankTransactionFieldErrors = {}

  if (!isUuid(bankAccountId)) {
    fieldErrors.bankAccountId = "Choose a bank account."
  }

  if (!isIsoDate(transactionDate)) {
    fieldErrors.transactionDate = "Enter a date."
  }

  if (!isBankDirection(direction)) {
    fieldErrors.direction = "Choose a direction."
  }

  if (!isBankSourceKind(sourceKind)) {
    fieldErrors.sourceKind = "Choose a source."
  }

  if (amount === null) {
    fieldErrors.amount = input.amount.trim()
      ? "Enter an amount greater than 0."
      : "Enter an amount."
  }

  if (projectId && !isUuid(projectId)) {
    fieldErrors.projectId = "Choose a project."
  }

  if (
    Object.keys(fieldErrors).length > 0 ||
    amount === null ||
    !isBankDirection(direction) ||
    !isBankSourceKind(sourceKind)
  ) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const account = await supabase
    .from("bank_accounts")
    .select("id")
    .eq("id", bankAccountId)
    .limit(1)

  if (account.error) {
    return { error: "Could not save this transaction." }
  }

  if (!account.data || account.data.length === 0) {
    return {
      error: null,
      fieldErrors: { bankAccountId: "Choose a bank account." },
    }
  }

  if (projectId) {
    const project = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .limit(1)
    if (project.error || !project.data || project.data.length === 0) {
      return { error: null, fieldErrors: { projectId: "Choose a project." } }
    }
  }

  const values = {
    bank_account_id: bankAccountId,
    transaction_date: transactionDate,
    direction,
    amount,
    source_kind: sourceKind,
    payment_method: paymentMethod || null,
    project_id: projectId || null,
    notes: notes || null,
  }

  const { data, error } = id
    ? await supabase
        .from("bank_transactions")
        .update(values)
        .eq("id", id)
        .select("id")
    : await supabase.from("bank_transactions").insert(values).select("id")

  if (error) {
    if (error.code === "23514") {
      return {
        error: null,
        fieldErrors: { amount: "Enter an amount greater than 0." },
      }
    }

    return { error: "Could not save this transaction." }
  }

  if (!data || data.length === 0) {
    return { error: "That transaction could not be found." }
  }

  revalidatePath("/accounts/bank")
  return { error: null }
}
