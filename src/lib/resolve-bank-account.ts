import { isUuid } from "@/lib/ids"
import { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

export async function resolveBankAccountId(
  supabase: SupabaseClient,
  bankAccountId: string,
  newAccountName: string,
  newBankName: string,
): Promise<{
  id: string | null
  error: string | null
  fieldError: string | null
}> {
  const id = bankAccountId.trim()
  const name = newAccountName.trim()
  const bankName = newBankName.trim()

  if (id) {
    if (!isUuid(id)) {
      return { id: null, error: null, fieldError: "Choose a bank account." }
    }

    const existing = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("id", id)
      .limit(1)

    if (existing.error) {
      return { id: null, error: "Could not save this record.", fieldError: null }
    }

    if (!existing.data || existing.data.length === 0) {
      return { id: null, error: null, fieldError: "Choose a bank account." }
    }

    return { id, error: null, fieldError: null }
  }

  if (!name) {
    return { id: null, error: null, fieldError: "Choose a bank account." }
  }

  const created = await supabase
    .from("bank_accounts")
    .insert({
      name,
      bank_name: bankName || null,
      currency: "BDT",
      is_active: true,
    })
    .select("id")

  if (created.error || !created.data?.[0]) {
    return { id: null, error: "Could not add the bank account.", fieldError: null }
  }

  return { id: created.data[0].id, error: null, fieldError: null }
}
