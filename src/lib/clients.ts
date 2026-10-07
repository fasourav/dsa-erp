import type { ClientSummary } from "@/lib/client-summary"
import { toNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

const PROJECT_PAGE_SIZE = 1000
const MAX_PROJECT_PAGES = 100

export async function getClientSummaries(): Promise<{
  clients: ClientSummary[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    // Total projects counts every status. The view only splits ongoing and completed.
    const [summariesResult, detailsResult, projectCounts] = await Promise.all([
      supabase
        .from("client_summaries")
        .select(
          "client_id, display_name, kind, ongoing_projects, completed_projects, total_project_value, total_paid, total_pending, gross_profit, gross_profit_pct",
        ),
      supabase
        .from("clients")
        .select("id, person_name, company_name, email, phone, notes, address"),
      countProjectsByClient(supabase),
    ])

    if (summariesResult.error || detailsResult.error) {
      return { clients: [], error: "Could not load clients." }
    }

    const details = new Map(
      (detailsResult.data ?? []).map((row) => [row.id, row]),
    )

    const clients = (summariesResult.data ?? []).flatMap((row) => {
      if (!row.client_id) {
        return []
      }

      const detail = details.get(row.client_id)

      return [
        {
          id: row.client_id,
          displayName: row.display_name?.trim() ?? "",
          kind: row.kind,
          ongoingProjects: toCount(row.ongoing_projects),
          completedProjects: toCount(row.completed_projects),
          totalProjects: projectCounts.get(row.client_id) ?? 0,
          totalProjectValue: toNumber(row.total_project_value),
          totalPaid: toNumber(row.total_paid),
          totalPending: toNumber(row.total_pending),
          grossProfit: toNumber(row.gross_profit),
          grossProfitPct:
            row.gross_profit_pct == null ? null : toNumber(row.gross_profit_pct),
          personName: detail?.person_name ?? null,
          companyName: detail?.company_name ?? null,
          email: detail?.email ?? null,
          phone: detail?.phone ?? null,
          notes: detail?.notes ?? null,
          address: detail?.address ?? null,
        } satisfies ClientSummary,
      ]
    })

    return { clients, error: null }
  } catch {
    return { clients: [], error: "Could not load clients." }
  }
}

async function countProjectsByClient(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const counts = new Map<string, number>()

  for (let page = 0; page < MAX_PROJECT_PAGES; page += 1) {
    const from = page * PROJECT_PAGE_SIZE
    const { data, error } = await supabase
      .from("projects")
      .select("client_id")
      .range(from, from + PROJECT_PAGE_SIZE - 1)

    if (error) {
      throw error
    }

    const rows = data ?? []

    for (const row of rows) {
      counts.set(row.client_id, (counts.get(row.client_id) ?? 0) + 1)
    }

    if (rows.length < PROJECT_PAGE_SIZE) {
      return counts
    }
  }

  throw new Error("Project list is larger than expected.")
}

function toCount(value: unknown): number {
  return Math.trunc(toNumber(value))
}
