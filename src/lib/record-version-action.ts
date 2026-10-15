"use server"

import { createClient } from "@/lib/supabase/server"

const versionedTables = [
  "leads",
  "clients",
  "vendors",
  "projects",
  "vendor_purchase_orders",
  "client_invoices",
  "vendor_invoices",
  "operational_expenses",
  "employees",
  "assets",
] as const

export type VersionedTable = (typeof versionedTables)[number]

/** The row's updated_at, sent back on save so the database can reject a stale edit. */
export async function recordVersion(table: VersionedTable, id: string): Promise<string | null> {
  if (!versionedTables.includes(table) || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const { data } = await supabase.from(table).select("updated_at").eq("id", id).maybeSingle()
  return (data as { updated_at?: string } | null)?.updated_at ?? null
}
