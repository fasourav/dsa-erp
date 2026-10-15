import type { SupabaseClient } from "@supabase/supabase-js"
import { after } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Database } from "@/types/database.types"

const bucket = "attachments"
const batchSize = 100
const maxBatches = 5

// Deleting an attachment row (directly or through its parent's delete trigger) queues
// its storage path in the database. Storage objects can only be removed through the
// Storage API, so this drains that queue. It never throws: a file left behind stays
// queued and the next drain or the daily sweep retries it.
// claim and settle are granted only to service_role, so the drain uses that client.
export async function removeQueuedAttachmentFiles(
  client?: SupabaseClient<Database>,
): Promise<number> {
  let removed = 0
  try {
    const admin = createAdminClient()
    const supabase = (admin ?? client ?? (await createClient())) as SupabaseClient<Database>
    for (let batch = 0; batch < maxBatches; batch += 1) {
      const { data, error } = await supabase.rpc("claim_attachment_file_purges", { p_limit: batchSize })
      if (error || !data || data.length === 0) break
      const paths = data.map((row) => row.path)
      const { error: removeError } = await supabase.storage.from(bucket).remove(paths)
      if (removeError) break
      const settled = await supabase.rpc("settle_attachment_file_purges", { p_paths: paths })
      const count = settled.data ?? 0
      removed += count
      if (settled.error || count < paths.length || data.length < batchSize) break
    }
  } catch {
    return removed
  }
  return removed
}

// Call after a successful delete of any record that can own attachments. The files are
// removed after the response is sent, so the delete never waits on Storage.
export function cleanUpDeletedAttachmentFiles(): void {
  after(async () => {
    await removeQueuedAttachmentFiles()
  })
}
