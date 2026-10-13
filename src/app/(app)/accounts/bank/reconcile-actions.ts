"use server"

import { revalidatePath } from "next/cache"

import { isBankDirection } from "@/lib/bank"
import { parseStatementCsv } from "@/lib/bank-reconcile"
import { friendlyDbError } from "@/lib/db-errors"
import { isUuid } from "@/lib/ids"
import { isIsoDate } from "@/lib/project-validation"
import { denyUnless } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

export async function importStatementCsv(formData: FormData): Promise<{ error: string | null; count: number }> {
  const denied = await denyUnless("banking", "edit")
  if (denied) return { error: denied, count: 0 }
  const accountId = String(formData.get("accountId") ?? "")
  const file = formData.get("file")
  if (!isUuid(accountId)) return { error: "Choose a bank account.", count: 0 }
  if (!(file instanceof File)) return { error: "Choose a CSV file.", count: 0 }

  const parsed = parseStatementCsv(await file.text())
  if (parsed.error) return { error: parsed.error, count: 0 }
  if (parsed.rows.length === 0) return { error: "The file has no lines.", count: 0 }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  // Re-importing the same statement (or an overlapping one) must not double the lines.
  // Compare as a multiset so genuinely repeated lines inside one file still import.
  const dates = parsed.rows.map((row) => row.lineDate).sort()
  const existing = await supabase
    .from("bank_statement_lines")
    .select("line_date, direction, amount, description, reference")
    .eq("bank_account_id", accountId)
    .gte("line_date", dates[0])
    .lte("line_date", dates[dates.length - 1])
  if (existing.error) {
    if (isMissing(existing.error)) return { error: notInstalled, count: 0 }
    return { error: friendlyDbError(existing.error, "Could not import this statement."), count: 0 }
  }
  const lineKey = (date: string, direction: string, amount: number, description: string | null, reference: string | null) =>
    [date, direction, Number(amount).toFixed(2), (description ?? "").trim(), (reference ?? "").trim()].join("|")
  const seen = new Map<string, number>()
  for (const row of existing.data ?? []) {
    const key = lineKey(row.line_date, row.direction, Number(row.amount), row.description, row.reference)
    seen.set(key, (seen.get(key) ?? 0) + 1)
  }
  const fresh = parsed.rows.filter((row) => {
    const key = lineKey(row.lineDate, row.direction, row.amount, row.description, row.reference)
    const left = seen.get(key) ?? 0
    if (left > 0) {
      seen.set(key, left - 1)
      return false
    }
    return true
  })
  if (fresh.length === 0) return { error: "Every line in this file is already imported.", count: 0 }

  const { error } = await supabase.from("bank_statement_lines").insert(
    fresh.map((row) => ({
      bank_account_id: accountId,
      line_date: row.lineDate,
      description: row.description,
      direction: row.direction,
      amount: row.amount,
      reference: row.reference,
      created_by: auth.user?.id ?? null,
    })),
  )
  if (error) {
    if (isMissing(error)) return { error: notInstalled, count: 0 }
    return { error: friendlyDbError(error, "Could not import this statement."), count: 0 }
  }
  revalidatePath("/accounts/bank")
  return { error: null, count: fresh.length }
}

export async function addStatementLine(input: {
  accountId: string
  lineDate: string
  description: string
  direction: string
  amount: string
  reference: string
}): Promise<{ error: string | null }> {
  const denied = await denyUnless("banking", "edit")
  if (denied) return { error: denied }
  if (!isUuid(input.accountId)) return { error: "Choose a bank account." }
  if (!isIsoDate(input.lineDate)) return { error: "Enter a date." }
  if (!isBankDirection(input.direction)) return { error: "Choose a direction." }
  const amount = Number(input.amount)
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter an amount greater than zero." }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getUser()
  const { error } = await supabase.from("bank_statement_lines").insert({
    bank_account_id: input.accountId,
    line_date: input.lineDate,
    description: input.description.trim(),
    direction: input.direction,
    amount: Math.round(amount * 100) / 100,
    reference: input.reference.trim(),
    created_by: auth.user?.id ?? null,
  })
  if (error) {
    if (isMissing(error)) return { error: notInstalled }
    return { error: friendlyDbError(error, "Could not add this line.") }
  }
  revalidatePath("/accounts/bank")
  return { error: null }
}

export async function matchStatementLine(
  lineId: string,
  transactionId: string | null,
): Promise<{ error: string | null }> {
  const denied = await denyUnless("banking", "edit")
  if (denied) return { error: denied }
  if (!isUuid(lineId) || (transactionId != null && !isUuid(transactionId))) {
    return { error: "That line could not be found." }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from("bank_statement_lines")
    .update({ bank_transaction_id: transactionId })
    .eq("id", lineId)
  if (error) {
    if (isMissing(error)) return { error: notInstalled }
    return { error: friendlyDbError(error, "Could not update this match.") }
  }
  revalidatePath("/accounts/bank")
  return { error: null }
}

export async function deleteStatementLine(id: string): Promise<{ error: string | null }> {
  const denied = await denyUnless("banking", "delete")
  if (denied) return { error: denied }
  if (!isUuid(id)) return { error: "That line could not be found." }
  const supabase = await createClient()
  const { error } = await supabase.from("bank_statement_lines").delete().eq("id", id)
  if (error) {
    if (isMissing(error)) return { error: notInstalled }
    return { error: friendlyDbError(error, "Could not delete this line.") }
  }
  revalidatePath("/accounts/bank")
  return { error: null }
}

export async function autoMatchStatement(input: {
  accountId: string
  from: string
  to: string
  days: number
}): Promise<{ error: string | null; count: number }> {
  const denied = await denyUnless("banking", "edit")
  if (denied) return { error: denied, count: 0 }
  if (!isUuid(input.accountId) || !isIsoDate(input.from) || !isIsoDate(input.to)) {
    return { error: "Choose an account and a period.", count: 0 }
  }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("auto_match_bank_statement", {
    p_account: input.accountId,
    p_from: input.from,
    p_to: input.to,
    p_days: input.days,
  })
  if (error) {
    if (isMissing(error)) return { error: notInstalled, count: 0 }
    return { error: friendlyDbError(error, "Could not match these lines."), count: 0 }
  }
  revalidatePath("/accounts/bank")
  return { error: null, count: data ?? 0 }
}

export async function markPeriodReconciled(input: {
  accountId: string
  from: string
  to: string
  statementBalance: string
}): Promise<{ error: string | null }> {
  const denied = await denyUnless("banking", "edit")
  if (denied) return { error: denied }
  if (!isUuid(input.accountId) || !isIsoDate(input.from) || !isIsoDate(input.to) || input.to < input.from) {
    return { error: "Choose an account and a valid period." }
  }
  const statementBalance = Number(input.statementBalance)
  if (!Number.isFinite(statementBalance)) return { error: "Enter the statement balance." }

  const supabase = await createClient()
  const { error } = await supabase.from("bank_reconciliations").insert({
    bank_account_id: input.accountId,
    period_start: input.from,
    period_end: input.to,
    statement_balance: Math.round(statementBalance * 100) / 100,
    book_balance: 0,
    difference: 0,
  })
  if (error) {
    if (isMissing(error)) return { error: notInstalled }
    return { error: friendlyDbError(error, "Could not lock this period.") }
  }
  revalidatePath("/accounts/bank")
  return { error: null }
}

const notInstalled = "Bank reconciliation is not installed on this database yet."

function isMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the function|schema cache|does not exist/i.test(error.message ?? "")
  )
}
