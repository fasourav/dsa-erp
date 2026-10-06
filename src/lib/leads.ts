import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export type LeadRow = {
  id: string
  leadName: string
  kind: "person" | "company"
  phone: string
  email: string
  projectDetails: string
  projectType: string
  source: string
  estimatedValue: number
  currentStage: string
  status: "open" | "won" | "lost" | "on_hold"
  probability: number
  notes: string
  convertedClientId: string
  convertedProjectId: string
  weightedValue: number
}

export type ProjectTypeOption = {
  id: string
  name: string
}

export async function getLeads(): Promise<{
  leads: LeadRow[]
  projectTypes: ProjectTypeOption[]
  error: string | null
}> {
  const supabase = await createClient()
  const projectTypes = await loadProjectTypes(supabase)

  try {
    const rows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("leads")
          .select(
            "id, lead_name, kind, phone, email, project_details, project_type, source, estimated_value, current_stage, status, probability, notes, converted_client_id, converted_project_id, created_at",
          )
          .order("created_at", { ascending: false })
          .range(from, to),
      "Lead list is larger than expected.",
    )

    const leads: LeadRow[] = rows.map((row) => {
      const estimatedValue = toNumber(row.estimated_value)
      const probability = toNumber(row.probability)
      const weightedValue =
        row.estimated_value == null || row.probability == null
          ? 0
          : Math.round(((estimatedValue * probability) / 100) * 100) / 100

      return {
        id: row.id,
        leadName: row.lead_name ?? "",
        kind: row.kind ?? "person",
        phone: row.phone ?? "",
        email: row.email ?? "",
        projectDetails: row.project_details ?? "",
        projectType: row.project_type ?? "",
        source: row.source ?? "",
        estimatedValue,
        currentStage: row.current_stage ?? "",
        status: row.status ?? "open",
        probability,
        notes: row.notes ?? "",
        convertedClientId: row.converted_client_id ?? "",
        convertedProjectId: row.converted_project_id ?? "",
        weightedValue,
      }
    })

    return { leads, projectTypes, error: null }
  } catch {
    return { leads: [], projectTypes, error: "Could not load leads." }
  }
}

async function loadProjectTypes(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ProjectTypeOption[]> {
  try {
    const rows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("project_types")
          .select("id, name")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
          .range(from, to),
      "Project types list is larger than expected.",
    )

    const seen = new Set<string>()
    const projectTypes: ProjectTypeOption[] = []

    for (const row of rows) {
      const name = row.name?.trim() ?? ""
      if (!name || seen.has(name)) continue
      seen.add(name)
      projectTypes.push({ id: row.id, name })
    }

    return projectTypes
  } catch {
    return []
  }
}
