"use server"

import { eqVersion, missedUpdateMessage, staleWriteMessage, withVersion } from "@/lib/record-version"
import { revalidatePath } from "next/cache"

import { dbIssue, friendlyDbError } from "@/lib/db-errors"
import { resolveDuplicateNotes, type DuplicateMatch } from "@/lib/duplicate-outflow"
import { isUuid } from "@/lib/ids"
import { overdraftMessage } from "@/lib/insufficient-balance"
import { resolveBankAccountId } from "@/lib/resolve-bank-account"
import { isIsoDate, parseProjectValue , isFutureIsoDate } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import { cleanUpDeletedAttachmentFiles } from "@/lib/attachment-files"
import { denyUnless } from "@/lib/permissions"

export type ExpenseInput = {
  version?: string
  expenseDate: string
  category: string
  amount: string
  paymentMethod: string
  departmentId: string
  notes: string
  bankAccountId: string
  newAccountName: string
  newBankName: string
  confirmNotDuplicate?: boolean
  duplicateReason?: string
}

export type ExpenseFieldErrors = {
  expenseDate?: string
  category?: string
  amount?: string
  departmentId?: string
  bankAccountId?: string
  duplicateReason?: string
}

export type ExpenseResult = {
  error: string | null
  fieldErrors?: ExpenseFieldErrors
  duplicates?: DuplicateMatch[]
}

export type DeleteResult = {
  error: string | null
}

export async function addOperationalExpense(
  input: ExpenseInput,
): Promise<ExpenseResult> {
  const denied = await denyUnless("expenses", "add")
  if (denied) return { error: denied }
  return saveExpense(null, input)
}

export async function updateOperationalExpense(
  id: string,
  input: ExpenseInput,
): Promise<ExpenseResult> {
  const denied = await denyUnless("expenses", "edit")
  if (denied) return { error: denied }
  if (!isUuid(id)) {
    return { error: "That expense could not be found." }
  }

  return saveExpense(id, input)
}

export async function deleteOperationalExpense(
  id: string,
): Promise<DeleteResult> {
  const denied = await denyUnless("expenses", "delete")
  if (denied) return { error: denied }
  if (!isUuid(id)) {
    return { error: "That expense could not be found." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("operational_expenses")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return { error: "This expense is used elsewhere and cannot be deleted." }
    }

    return { error: "Could not delete this expense." }
  }

  if (!data || data.length === 0) {
    return { error: "That expense could not be found." }
  }

  cleanUpDeletedAttachmentFiles()
  revalidatePath("/accounts/expenses")
  revalidatePath("/accounts/bank")
  return { error: null }
}

async function saveExpense(
  id: string | null,
  input: ExpenseInput,
): Promise<ExpenseResult> {
  const expenseDate = input.expenseDate.trim()
  const category = input.category.trim()
  const departmentId = input.departmentId.trim()
  const notes = input.notes.trim()
  const paymentMethod = input.paymentMethod.trim()
  const amount = parseProjectValue(input.amount)
  const fieldErrors: ExpenseFieldErrors = {}

  if (!isIsoDate(expenseDate)) {
    fieldErrors.expenseDate = "Enter a date."
  } else if (isFutureIsoDate(expenseDate)) {
    fieldErrors.expenseDate = "Date can't be in the future."
  }

  if (!category) {
    fieldErrors.category = "Choose a category."
  }

  if (amount === null || amount <= 0) {
    fieldErrors.amount = input.amount.trim()
      ? "Enter an amount greater than 0."
      : "Enter an amount."
  }

  if (departmentId && !isUuid(departmentId)) {
    fieldErrors.departmentId = "Choose a department."
  }

  if (Object.keys(fieldErrors).length > 0 || amount === null || amount <= 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const categoryMatch = await supabase
    .from("office_expense_categories")
    .select("id")
    .eq("name", category)
    .limit(1)
  if (categoryMatch.error) {
    return { error: "Could not save this expense." }
  }
  if (!categoryMatch.data || categoryMatch.data.length === 0) {
    return { error: null, fieldErrors: { category: "Choose a category." } }
  }

  if (departmentId) {
    const department = await supabase
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .eq("is_active", true)
      .limit(1)
    if (department.error) {
      return { error: "Could not save this expense." }
    }
    if (!department.data || department.data.length === 0) {
      return {
        error: null,
        fieldErrors: { departmentId: "Choose a department." },
      }
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
    return { error: bank.error ?? "Could not save this expense." }
  }

  let release = 0
  if (id) {
    const current = await supabase
      .from("bank_transactions_readable")
      .select("amount")
      .eq("operational_expense_id", id)
      .limit(1)
    const currentAmount = current.data?.[0]?.amount
    if (!current.error && currentAmount != null) release = Number(currentAmount)
  }
  const overdraft = await overdraftMessage(supabase, {
    accountId: bank.id,
    needed: amount,
    release,
  })
  if (overdraft) {
    return { error: overdraft, fieldErrors: { bankAccountId: overdraft, amount: overdraft } }
  }

  const duplicate = await resolveDuplicateNotes(supabase, {
    amount,
    bankAccountId: bank.id,
    date: expenseDate,
    notes,
    confirmNotDuplicate: input.confirmNotDuplicate === true,
    duplicateReason: input.duplicateReason ?? "",
    exceptExpenseId: id,
    exceptPaymentId: null,
  })
  if (duplicate.status === "error") return { error: duplicate.error }
  if (duplicate.status === "blocked") {
    return {
      error: null,
      duplicates: duplicate.matches,
      fieldErrors: { duplicateReason: duplicate.reasonError },
    }
  }

  const values = {
    expense_date: expenseDate,
    category,
    amount,
    payment_method: paymentMethod || null,
    department_id: departmentId || null,
    notes: duplicate.notes || null,
    bank_account_id: bank.id,
  }

  const { data, error } = id
    ? await eqVersion(
        supabase.from("operational_expenses").update(withVersion(values, input.version)).eq("id", id),
        input.version,
      ).select("id")
    : await supabase
        .from("operational_expenses")
        .insert({ ...values, vendor_id: null })
        .select("id")

  if (error) {
    const stale = staleWriteMessage(error)
    if (stale) return { error: stale }

    const issue = dbIssue(error)
    if (issue?.field === "bankAccountId") {
      return {
        error: issue.message,
        fieldErrors: { bankAccountId: issue.message, amount: issue.message },
      }
    }
    if (error.code === "23503") {
      return { error: "Choose a valid department." }
    }

    if (error.code === "23514" && issue?.message === "This value is not allowed.") {
      return {
        error: null,
        fieldErrors: { amount: "Enter an amount greater than 0." },
      }
    }

    return { error: friendlyDbError(error, "Could not save this expense.") }
  }

  if (!data || data.length === 0) {
    return { error: missedUpdateMessage(id ? input.version : undefined, "That expense could not be found.") }
  }

  revalidatePath("/accounts/expenses")
  revalidatePath("/accounts/bank")
  return { error: null }
}
