import type { BankAccountChoice } from "@/lib/bank-account"
import { fetchAllPages } from "@/lib/fetch-pages"
import { createClient } from "@/lib/supabase/server"

export async function listBankAccounts(): Promise<BankAccountChoice[]> {
  const supabase = await createClient()
  const rows = await fetchAllPages(
    (from, to) =>
      supabase
        .from("bank_accounts")
        .select("id, name, is_active")
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to),
    "Bank account list is larger than expected.",
  )

  return rows.map((row) => ({
    id: row.id,
    name: row.name?.trim() ?? "",
    isActive: row.is_active,
  }))
}
