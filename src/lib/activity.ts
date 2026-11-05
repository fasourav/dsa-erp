import { getAccess } from "@/lib/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Json } from "@/types/database.types"

export async function logActivity(input: {
  module: string
  tableName: string
  recordId: string
  recordLabel: string
  action: "insert" | "update" | "delete"
  summary: string
  newValues?: Record<string, unknown>
}) {
  try {
    const access = await getAccess()
    if (!access) return
    const admin = createAdminClient()
    if (!admin) return
    await admin.from("activity_log").insert({
      actor_id: access.userId,
      action: input.action,
      module: input.module,
      table_name: input.tableName,
      record_id: input.recordId,
      record_label: input.recordLabel,
      summary: input.summary,
      old_values: null,
      new_values: (input.newValues ?? null) as Json | null,
    })
  } catch {
    // A logging failure must not block the profile or stamp write.
  }
}
