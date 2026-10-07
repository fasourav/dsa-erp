import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export type LeadStatusCode = string

export type LeadRow = {
  id: string
  leadName: string
  kind: "person" | "company"
  kindLabel: string
  phone: string
  email: string
  projectName: string
  projectType: string
  source: string
  estimatedValue: number
  currentStage: string
  status: LeadStatusCode
  statusLabel: string
  statusIsOpen: boolean
  probability: number
  notes: string
  convertedClientId: string
  convertedProjectId: string
  weightedValue: number
  createdOn: string
}

export type CatalogOption = {
  id: string
  name: string
}

export type LeadTypeOption = {
  id: string
  code: string
  name: string
}

export type LeadStatusOption = {
  id: string
  code: string
  name: string
  isOpen: boolean
}

export type ProjectTypeOption = {
  id: string
  name: string
}

export type LeadLookups = {
  leadTypes: LeadTypeOption[]
  projectTypes: ProjectTypeOption[]
  sources: CatalogOption[]
  stages: CatalogOption[]
  statuses: LeadStatusOption[]
}

const emptyLookups: LeadLookups = {
  leadTypes: [],
  projectTypes: [],
  sources: [],
  stages: [],
  statuses: [],
}

export async function getLeads(): Promise<{
  leads: LeadRow[]
  lookups: LeadLookups
  error: string | null
}> {
  const supabase = await createClient()
  const lookups = await loadLeadLookups(supabase)

  try {
    const rows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("leads")
          .select(
            "id, lead_name, kind, phone, email, project_name, project_type, source, estimated_value, current_stage, status, probability, notes, converted_client_id, converted_project_id, created_at",
          )
          .order("created_at", { ascending: false })
          .range(from, to),
      "Lead list is larger than expected.",
    )

    const typeByCode = new Map(
      lookups.leadTypes.map((item) => [item.code, item.name] as const),
    )
    const statusByCode = new Map(
      lookups.statuses.map((item) => [item.code, item] as const),
    )

    const leads: LeadRow[] = rows.map((row) => {
      const estimatedValue = toNumber(row.estimated_value)
      const probability = toNumber(row.probability)
      const weightedValue =
        row.estimated_value == null || row.probability == null
          ? 0
          : Math.round(((estimatedValue * probability) / 100) * 100) / 100
      const statusCode = (row.status ?? "open") as LeadStatusCode
      const statusMeta = statusByCode.get(statusCode)
      const kind = (row.kind ?? "person") as "person" | "company"

      return {
        id: row.id,
        leadName: row.lead_name ?? "",
        kind,
        kindLabel: typeByCode.get(kind) ?? (kind === "company" ? "Company" : "Person"),
        phone: row.phone ?? "",
        email: row.email ?? "",
        projectName: row.project_name ?? "",
        projectType: row.project_type ?? "",
        source: row.source ?? "",
        estimatedValue,
        currentStage: row.current_stage ?? "",
        status: statusCode,
        statusLabel: statusMeta?.name ?? titleCaseStatus(statusCode),
        statusIsOpen: statusMeta?.isOpen ?? (statusCode === "open" || statusCode === "on_hold"),
        probability,
        notes: row.notes ?? "",
        convertedClientId: row.converted_client_id ?? "",
        convertedProjectId: row.converted_project_id ?? "",
        weightedValue,
        createdOn: typeof row.created_at === "string" ? row.created_at.slice(0, 10) : "",
      }
    })

    return { leads, lookups, error: null }
  } catch {
    return { leads: [], lookups, error: "Could not load leads." }
  }
}

async function loadLeadLookups(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<LeadLookups> {
  try {
    const [types, projectTypes, sources, stages, statuses] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("lead_types")
            .select("id, code, name")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        "Lead types list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("project_types")
            .select("id, name")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        "Project types list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("lead_sources")
            .select("id, name")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        "Lead sources list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("lead_stages")
            .select("id, name")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        "Lead stages list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("lead_statuses")
            .select("id, code, name, is_open")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        "Lead statuses list is larger than expected.",
      ),
    ])

    return {
      leadTypes: types.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
      })),
      projectTypes: uniqueNamed(projectTypes),
      sources: uniqueNamed(sources),
      stages: uniqueNamed(stages),
      statuses: statuses.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        isOpen: Boolean(row.is_open),
      })),
    }
  } catch {
    return emptyLookups
  }
}

function uniqueNamed(
  rows: { id: string; name: string | null }[],
): CatalogOption[] {
  const seen = new Set<string>()
  const options: CatalogOption[] = []

  for (const row of rows) {
    const name = row.name?.trim() ?? ""
    if (!name || seen.has(name)) continue
    seen.add(name)
    options.push({ id: row.id, name })
  }

  return options
}

function titleCaseStatus(code: string): string {
  return code
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
