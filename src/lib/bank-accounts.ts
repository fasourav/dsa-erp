import type { BankAccountRow } from "@/lib/bank"
import type { BankAccountChoice } from "@/lib/bank-account"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export async function getSettingsBankAccounts(): Promise<{
  accounts: BankAccountRow[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const rows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("bank_accounts")
          .select(
            "id, name, account_holder_name, account_number, bank_name, routing_number, address, opening_balance, currency, is_active, sort_order",
          )
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      "Bank account list is larger than expected.",
    )

    return {
      accounts: rows.map((row) => ({
        id: row.id,
        name: row.name?.trim() ?? "",
        accountHolderName: row.account_holder_name?.trim() ?? "",
        accountNumber: row.account_number?.trim() ?? "",
        bankName: row.bank_name?.trim() ?? "",
        routingNumber: row.routing_number?.trim() ?? "",
        address: row.address?.trim() ?? "",
        openingBalance: toNumber(row.opening_balance),
        currency: row.currency?.trim() ?? "",
        isActive: row.is_active,
        sortOrder: row.sort_order,
      })),
      error: null,
    }
  } catch {
    return { accounts: [], error: "Could not load bank accounts." }
  }
}

export async function listBankAccounts(): Promise<BankAccountChoice[]> {
  const supabase = await createClient()
  const rows = await fetchAllPages(
    (from, to) =>
      supabase
        .from("bank_accounts")
        .select("id, name, is_active, sort_order")
        .order("sort_order", { ascending: true })
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

export async function listPaymentMethodNames(): Promise<string[]> {
  const supabase = await createClient()
  const rows = await fetchAllPages(
    (from, to) =>
      supabase
        .from("payment_methods")
        .select("name, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
        .range(from, to),
    "Payment method list is larger than expected.",
  )

  return rows.map((row) => row.name)
}
