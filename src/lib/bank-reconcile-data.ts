import { isBankDirection } from "@/lib/bank"
import {
  type LockedPeriod,
  type ReconciliationBundle,
  type StatementLine,
} from "@/lib/bank-reconcile"
import { toNumber } from "@/lib/format"
import { isUuid } from "@/lib/ids"
import { createClient } from "@/lib/supabase/server"

const empty: ReconciliationBundle = {
  status: "ready",
  error: null,
  tolerances: [],
  lines: [],
  periods: [],
}

export async function getReconciliation(accountId: string | null): Promise<ReconciliationBundle> {
  const supabase = await createClient()
  const account = accountId && isUuid(accountId) ? accountId : null

  const tolerancesQuery = supabase
    .from("bank_match_tolerances")
    .select("days, label, sort_order")
    .order("sort_order", { ascending: true })
    .order("days", { ascending: true })

  const linesQuery = account
    ? supabase
        .from("bank_statement_lines")
        .select("id, line_date, description, direction, amount, reference, bank_transaction_id")
        .eq("bank_account_id", account)
        .order("line_date", { ascending: true })
        .order("created_at", { ascending: true })
    : null

  const periodsQuery = account
    ? supabase
        .from("bank_reconciliations")
        .select("id, period_start, period_end, statement_balance, book_balance, difference")
        .eq("bank_account_id", account)
        .order("period_start", { ascending: false })
    : null

  const [tolerancesResult, linesResult, periodsResult] = await Promise.all([
    tolerancesQuery,
    linesQuery,
    periodsQuery,
  ])

  const failure = [tolerancesResult.error, linesResult?.error, periodsResult?.error].find(
    (error) => error != null,
  )
  if (failure) {
    if (isMissing(failure)) return { ...empty, status: "missing" }
    return { ...empty, status: "error", error: "Could not load reconciliation." }
  }

  const tolerances = (tolerancesResult.data ?? []).map((row) => ({
    days: row.days,
    label: row.label,
  }))

  const lines: StatementLine[] = []
  for (const row of linesResult?.data ?? []) {
    if (!isBankDirection(row.direction)) continue
    lines.push({
      id: row.id,
      lineDate: row.line_date,
      description: row.description,
      direction: row.direction,
      amount: toNumber(row.amount),
      reference: row.reference,
      bankTransactionId: row.bank_transaction_id,
    })
  }

  const periods: LockedPeriod[] = (periodsResult?.data ?? []).map((row) => ({
    id: row.id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    statementBalance: toNumber(row.statement_balance),
    bookBalance: toNumber(row.book_balance),
    difference: toNumber(row.difference),
  }))

  return { status: "ready", error: null, tolerances, lines, periods }
}

function isMissing(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    /could not find the function|schema cache|does not exist/i.test(error.message ?? "")
  )
}
