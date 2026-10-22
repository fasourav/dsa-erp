import type { SupabaseClient } from "@supabase/supabase-js"

import type { Database } from "@/types/database.types"

type Db = SupabaseClient<Database>

export async function creatorNames(
  supabase: Db,
  table: "operational_expenses" | "vendor_payments",
  rows: readonly { id: string; createdBy: string | null }[],
): Promise<Map<string, string>> {
  const actorByRecord = new Map<string, string>()
  for (const row of rows) {
    if (row.createdBy) actorByRecord.set(row.id, row.createdBy)
  }

  const missing = rows.filter((row) => !row.createdBy).map((row) => row.id)
  if (missing.length > 0) {
    const logged = await selectChunks(missing, (chunk) =>
      supabase
        .from("activity_log")
        .select("record_id, actor_id")
        .eq("table_name", table)
        .eq("action", "insert")
        .in("record_id", chunk),
    )
    for (const row of logged) {
      if (row.record_id && row.actor_id && !actorByRecord.has(row.record_id)) {
        actorByRecord.set(row.record_id, row.actor_id)
      }
    }
  }

  const actorIds = [...new Set(actorByRecord.values())]
  const profileNames = new Map<string, string>()
  if (actorIds.length > 0) {
    const profiles = await selectChunks(actorIds, (chunk) =>
      supabase.from("profiles").select("id, display_name, email").in("id", chunk),
    )
    for (const profile of profiles) {
      profileNames.set(
        profile.id,
        profile.display_name?.trim() || profile.email?.trim() || "User",
      )
    }
  }

  const names = new Map<string, string>()
  for (const row of rows) {
    const actorId = actorByRecord.get(row.id)
    names.set(row.id, actorId ? profileNames.get(actorId) ?? "User" : "Unknown")
  }
  return names
}

async function selectChunks<T>(
  ids: readonly string[],
  load: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let index = 0; index < ids.length; index += 100) {
    const result = await load(ids.slice(index, index + 100))
    if (result.error || !result.data) continue
    rows.push(...result.data)
  }
  return rows
}
