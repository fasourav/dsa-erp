"use server"

import { createClient } from "@/lib/supabase/server"
import { searchHref, type SearchHit } from "@/lib/search"

export async function searchRecords(
  query: string,
): Promise<{ results: SearchHit[]; error: string | null }> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return { results: [], error: null }
  if (trimmed.length > 80) return { results: [], error: "Use a shorter search." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("search_records", { query: trimmed })

  if (error) {
    if (/search_records|schema cache|PGRST202|function/i.test(error.message)) {
      return { results: [], error: "Search is not available yet." }
    }
    return { results: [], error: "Could not search records." }
  }

  return {
    results: (data ?? []).map((row) => ({
      moduleKey: row.module_key,
      moduleLabel: row.module_label,
      recordId: row.record_id,
      label: row.label,
      detail: row.detail,
      href: searchHref(row.module_key, row.record_id, row.label),
    })),
    error: null,
  }
}
