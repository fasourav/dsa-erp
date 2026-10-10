"use server"

import { revalidatePath } from "next/cache"

import { isBankSourceKind } from "@/lib/bank"
import { isUuid } from "@/lib/ids"
import { isSortOrder } from "@/lib/lookup-catalogs"
import { parsePositiveAmount } from "@/lib/payment-status"
import { isIsoDate, parseProjectValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export type BankAccountInput = {
  name: string
  accountHolderName: string
  accountNumber: string
  bankName: string
  routingNumber: string
  address: string
  openingBalance: string
  currency: string
  isActive: boolean
  sortOrder: number
}

export type BankAccountFieldErrors = {
  name?: string
  accountHolderName?: string
  accountNumber?: string
  bankName?: string
  routingNumber?: string
  address?: string
  openingBalance?: string
  currency?: string
  sortOrder?: string
}

export type BankAccountResult = {
  error: string | null
  fieldErrors?: BankAccountFieldErrors
}

export type BankMovementInput = {
  kind: string
  bankAccountId: string
  transactionDate: string
  amount: string
  paymentMethod: string
  notes: string
}

export type BankMovementFieldErrors = {
  bankAccountId?: string
  transactionDate?: string
  amount?: string
  kind?: string
}

export type BankTransferInput = {
  fromAccountId: string
  toAccountId: string
  transactionDate: string
  amount: string
  paymentMethod: string
  notes: string
}

export type BankTransferFieldErrors = {
  fromAccountId?: string
  toAccountId?: string
  transactionDate?: string
  amount?: string
}

export type BankMovementResult = {
  error: string | null
  fieldErrors?: BankMovementFieldErrors
}

export type BankTransferResult = {
  error: string | null
  fieldErrors?: BankTransferFieldErrors
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

export async function setBankAccountActive(
  id: string,
  isActive: boolean,
): Promise<BankAccountResult> {
  if (!isUuid(id)) {
    return { error: "That bank account could not be found." }
  }

  if (typeof isActive !== "boolean") {
    return { error: "Could not update this bank account." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("bank_accounts")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("id")

  if (error) {
    return { error: "Could not update this bank account." }
  }

  if (!data || data.length === 0) {
    return { error: "That bank account could not be found." }
  }

  revalidateBankAccounts()
  return { error: null }
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
        error: "This account is in use and cannot be deleted.",
      }
    }

    return { error: "Could not delete this bank account." }
  }

  if (!data || data.length === 0) {
    return { error: "That bank account could not be found." }
  }

  revalidateBankAccounts()
  return { error: null }
}

export async function addBankMovement(
  input: BankMovementInput,
): Promise<BankMovementResult> {
  return saveBankMovement(null, input)
}

export async function updateBankMovement(
  id: string,
  input: BankMovementInput,
): Promise<BankMovementResult> {
  if (!isUuid(id)) {
    return { error: "That transaction could not be found." }
  }

  return saveBankMovement(id, input)
}

export async function addBankTransfer(
  input: BankTransferInput,
): Promise<BankTransferResult> {
  const fromAccountId = input.fromAccountId.trim()
  const toAccountId = input.toAccountId.trim()
  const transactionDate = input.transactionDate.trim()
  const amount = parsePositiveAmount(input.amount)
  const fieldErrors: BankTransferFieldErrors = {}

  if (!isUuid(fromAccountId)) {
    fieldErrors.fromAccountId = "Choose the account to transfer from."
  }
  if (!isUuid(toAccountId)) {
    fieldErrors.toAccountId = "Choose the account to transfer to."
  }
  if (fromAccountId && fromAccountId === toAccountId) {
    fieldErrors.toAccountId = "Choose a different account."
  }
  if (!isIsoDate(transactionDate)) {
    fieldErrors.transactionDate = "Enter a date."
  }
  if (amount === null) {
    fieldErrors.amount = input.amount.trim()
      ? "Enter an amount greater than 0."
      : "Enter an amount."
  }
  if (Object.keys(fieldErrors).length > 0 || amount === null) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { error } = await supabase.from("bank_transfers").insert({
    from_account_id: fromAccountId,
    to_account_id: toAccountId,
    amount,
    transfer_date: transactionDate,
    payment_method: input.paymentMethod.trim() || null,
    notes: input.notes.trim() || null,
  })

  if (error) {
    if (error.code === "23514") {
      return {
        error: null,
        fieldErrors: { amount: "Enter an amount greater than 0." },
      }
    }
    return { error: "Could not save this transfer." }
  }

  revalidatePath("/accounts/bank")
  revalidatePath("/dashboard")
  return { error: null }
}

export async function updateFiscalYearStartMonth(
  month: number,
): Promise<{ error: string | null }> {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { error: "Choose a month from January to December." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { error } = await supabase
    .from("company_settings")
    .update({
      fiscal_year_start_month: month,
      updated_at: new Date().toISOString(),
    })
    .eq("id", true)

  if (error) {
    return { error: "Could not save the fiscal year." }
  }

  revalidatePath("/settings")
  revalidatePath("/accounts/bank")
  return { error: null }
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

  const existing = await supabase
    .from("bank_transactions")
    .select(
      "id, income_id, vendor_payment_id, operational_expense_id, vat_tax_payment_id, payroll_line_id",
    )
    .eq("id", id)
    .limit(1)

  if (existing.error) {
    return { error: "Could not delete this transaction." }
  }

  const row = existing.data?.[0]
  if (!row) {
    return { error: "That transaction could not be found." }
  }

  if (row.payroll_line_id) {
    return {
      error: "This transaction comes from payroll. Change it there.",
    }
  }

  if (
    row.income_id ||
    row.vendor_payment_id ||
    row.operational_expense_id ||
    row.vat_tax_payment_id
  ) {
    return {
      error: "This transaction comes from a payment or expense. Change it there.",
    }
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
  revalidatePath("/dashboard")
  return { error: null }
}

async function saveBankAccount(
  id: string | null,
  input: BankAccountInput,
): Promise<BankAccountResult> {
  const name = input.name.trim()
  const accountHolderName = input.accountHolderName.trim()
  const accountNumber = input.accountNumber.trim()
  const bankName = input.bankName.trim()
  const routingNumber = input.routingNumber.trim()
  const address = input.address.trim()
  const currency = input.currency.trim()
  const openingBalance = parseProjectValue(input.openingBalance)
  const fieldErrors: BankAccountFieldErrors = {}

  if (!name) {
    fieldErrors.name = "Enter an account name."
  }
  if (!accountHolderName) {
    fieldErrors.accountHolderName = "Enter the account holder name."
  }
  if (!accountNumber) {
    fieldErrors.accountNumber = "Enter the account number."
  }
  if (!bankName) {
    fieldErrors.bankName = "Enter the bank name."
  }
  if (!routingNumber) {
    fieldErrors.routingNumber = "Enter the routing number."
  }
  if (!address) {
    fieldErrors.address = "Enter the address."
  }
  if (!id && openingBalance === null) {
    fieldErrors.openingBalance = input.openingBalance.trim()
      ? "Enter an opening balance of 0 or more."
      : "Enter the opening balance."
  }
  if (!currency) {
    fieldErrors.currency = "Enter a currency."
  }
  if (!isSortOrder(input.sortOrder)) {
    fieldErrors.sortOrder = "Enter a whole number."
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const details = {
    name,
    account_holder_name: accountHolderName,
    account_number: accountNumber,
    bank_name: bankName,
    routing_number: routingNumber,
    address,
    currency,
    is_active: input.isActive,
    sort_order: input.sortOrder,
  }

  const { data, error } = id
    ? await supabase.from("bank_accounts").update(details).eq("id", id).select("id")
    : await supabase
        .from("bank_accounts")
        .insert({ ...details, opening_balance: openingBalance ?? 0 })
        .select("id")

  if (error) {
    if (error.code === "23514") {
      return {
        error:
          "Account holder name, account number, bank name, routing number, and address are required.",
      }
    }
    return { error: "Could not save this bank account." }
  }

  if (!data || data.length === 0) {
    return { error: "That bank account could not be found." }
  }

  revalidateBankAccounts()
  return { error: null }
}

function revalidateBankAccounts() {
  revalidatePath("/settings")
  revalidatePath("/accounts/bank")
  revalidatePath("/accounts/invoices")
  revalidatePath("/accounts/expenses")
  revalidatePath("/accounts/payable")
  revalidatePath("/accounts/receivable")
  revalidatePath("/purchase-orders")
  revalidatePath("/purchase-orders/[id]", "page")
}

const manualKinds = ["deposit", "withdrawal"] as const

function isManualKind(value: string): value is (typeof manualKinds)[number] {
  return isBankSourceKind(value) && (value === "deposit" || value === "withdrawal")
}

async function saveBankMovement(
  id: string | null,
  input: BankMovementInput,
): Promise<BankMovementResult> {
  const kind = input.kind.trim()
  const bankAccountId = input.bankAccountId.trim()
  const transactionDate = input.transactionDate.trim()
  const amount = parsePositiveAmount(input.amount)
  const fieldErrors: BankMovementFieldErrors = {}

  if (!isManualKind(kind)) {
    fieldErrors.kind = "Choose a deposit or a withdrawal."
  }
  if (!isUuid(bankAccountId)) {
    fieldErrors.bankAccountId = "Choose a bank account."
  }
  if (!isIsoDate(transactionDate)) {
    fieldErrors.transactionDate = "Enter a date."
  }
  if (amount === null) {
    fieldErrors.amount = input.amount.trim()
      ? "Enter an amount greater than 0."
      : "Enter an amount."
  }
  if (Object.keys(fieldErrors).length > 0 || amount === null || !isManualKind(kind)) {
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

  if (id) {
    const existing = await supabase
      .from("bank_transactions")
      .select(
        "source_kind, income_id, vendor_payment_id, operational_expense_id, vat_tax_payment_id, payroll_line_id, transfer_id",
      )
      .eq("id", id)
      .limit(1)

    if (existing.error) {
      return { error: "Could not save this transaction." }
    }
    const row = existing.data?.[0]
    if (!row) {
      return { error: "That transaction could not be found." }
    }
    if (
      row.income_id ||
      row.vendor_payment_id ||
      row.operational_expense_id ||
      row.vat_tax_payment_id ||
      row.payroll_line_id ||
      row.transfer_id ||
      (row.source_kind !== "other" &&
        row.source_kind !== "deposit" &&
        row.source_kind !== "withdrawal")
    ) {
      return {
        error: "This transaction comes from a payment or expense. Change it there.",
      }
    }
  }

  const values = {
    bank_account_id: bankAccountId,
    transaction_date: transactionDate,
    direction: kind === "deposit" ? ("inflow" as const) : ("outflow" as const),
    amount,
    source_kind: kind,
    payment_method: input.paymentMethod.trim() || null,
    notes: input.notes.trim() || null,
    project_id: null,
  }

  const { data, error } = id
    ? await supabase.from("bank_transactions").update(values).eq("id", id).select("id")
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
  revalidatePath("/dashboard")
  return { error: null }
}
