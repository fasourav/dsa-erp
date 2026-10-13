import type { SupabaseClient } from "@supabase/supabase-js"

import { insufficientBalanceMessage } from "@/lib/db-errors"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import type { Database } from "@/types/database.types"

type Client = SupabaseClient<Database>

function cents(value: number): number {
  return Math.round(value * 100)
}

// Returns the form message when this outflow would overdraw the account.
// Returns null when the save can proceed, or when this user cannot see balances.
export async function overdraftMessage(
  supabase: Client,
  input: {
    accountId: string
    needed: number
    release?: number
  },
): Promise<string | null> {
  const account = await supabase
    .from("bank_accounts_readable")
    .select("name, opening_balance")
    .eq("id", input.accountId)
    .limit(1)

  if (account.error || !account.data || account.data.length === 0) return null

  const row = account.data[0]
  if (row.opening_balance == null) return null

  let lines: { amount: number | null; direction: string | null }[]
  try {
    lines = await fetchAllPages(
      (from, to) =>
        supabase
          .from("bank_transactions_readable")
          .select("amount, direction")
          .eq("bank_account_id", input.accountId)
          .order("id", { ascending: true })
          .range(from, to),
      "Bank ledger is larger than expected.",
    )
  } catch {
    return null
  }

  if (lines.some((line) => line.amount == null)) return null

  let balance = toNumber(row.opening_balance)
  for (const line of lines) {
    const amount = toNumber(line.amount)
    balance += line.direction === "inflow" ? amount : -amount
  }

  const available = balance + (input.release ?? 0)
  if (cents(input.needed) <= cents(available)) return null

  return insufficientBalanceMessage(row.name?.trim() || "this account", available, input.needed)
}
