import { fetchAllPages } from "@/lib/fetch-pages"
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

  try {
    const [pipelineRows, typeRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("lead_pipeline")
            .select("*")
            .order("created_at", { ascending: false })
            .range(from, to),
        "Lead list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("project_types")
            .select("id, name")
            .order("sort_order", { ascending: true })
            .range(from, to),
        "Project types list is larger than expected.",
      ),
    ])

    const leads: LeadRow[] = pipelineRows.map((r) => ({
      id: r.lead_id ?? "",
      leadName: r.lead_name ?? "",
      kind: (r.kind as "person" | "company") ?? "person",
      phone: r.phone ?? "",
      email: r.email ?? "",
      projectDetails: r.project_details ?? "",
      projectType: r.project_type ?? "",
      source: r.source ?? "",
      estimatedValue: r.estimated_value ?? 0,
      currentStage: r.current_stage ?? "",
      status: (r.status as LeadRow["status"]) ?? "open",
      probability: r.probability ?? 0,
      notes: "",
      convertedClientId: r.converted_client_id ?? "",
      convertedProjectId: r.converted_project_id ?? "",
      weightedValue: r.weighted_value ?? 0,
    }))

    const leadRaw = await fetchAllPages(
      (from, to) =>
        supabase
          .from("leads")
          .select("id, notes")
          .order("id", { ascending: true })
          .range(from, to),
      "Lead list is larger than expected.",
    )

    const notesMap = new Map(leadRaw.map((l) => [l.id, l.notes ?? ""]))
    for (const lead of leads) {
      lead.notes = notesMap.get(lead.id) ?? ""
    }

    const projectTypes: ProjectTypeOption[] = typeRows.map((t) => ({
      id: t.id,
      name: t.name,
    }))

    return { leads, projectTypes, error: null }
  } catch {
    return { leads: [], projectTypes: [], error: "Could not load leads." }
  }
}
