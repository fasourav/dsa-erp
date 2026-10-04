import { toNumber } from "@/lib/format"
import {
  clientDisplayName,
  type CatalogOption,
  type ClientOption,
  type ProjectRow,
} from "@/lib/project-summary"
import { dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

const PAGE_SIZE = 1000
const MAX_PAGES = 100

export async function getProjects(): Promise<{
  projects: ProjectRow[]
  clients: ClientOption[]
  projectTypes: CatalogOption[]
  projectPhases: CatalogOption[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const [projectRows, financialRows, clientRows, typeRows, phaseRows] =
      await Promise.all([
      fetchPages((from, to) =>
        supabase
          .from("projects")
          .select(
            "id, name, client_id, location, started_on, project_type, status, current_phase, total_value, details",
          )
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchPages((from, to) =>
        supabase
          .from("project_financials")
          .select(
            "project_id, total_value, total_paid, total_pending_due, gross_profit",
          )
          .order("project_id", { ascending: true })
          .range(from, to),
      ),
      fetchPages((from, to) =>
        supabase
          .from("clients")
          .select("id, person_name, company_name")
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchPages((from, to) =>
        supabase
          .from("project_types")
          .select("id, name, sort_order")
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      ),
      fetchPages((from, to) =>
        supabase
          .from("project_phases")
          .select("id, name, sort_order")
          .order("sort_order", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to),
      ),
    ])

    const clientsById = new Map(clientRows.map((row) => [row.id, row]))
    const financialsById = new Map(
      financialRows.flatMap((row) =>
        row.project_id ? [[row.project_id, row] as const] : [],
      ),
    )

    const projects = projectRows.map((row) => {
      const financial = financialsById.get(row.id)
      const client = clientsById.get(row.client_id)

      return {
        id: row.id,
        name: row.name.trim(),
        clientId: row.client_id,
        clientName: client
          ? clientDisplayName(client.person_name, client.company_name)
          : "",
        location: row.location?.trim() ?? "",
        startedOn: dateInputValue(row.started_on),
        projectType: row.project_type?.trim() ?? "",
        status: row.status,
        phase: row.current_phase?.trim() ?? "",
        totalValue: toNumber(financial?.total_value ?? row.total_value),
        totalPaid: toNumber(financial?.total_paid),
        totalDue: toNumber(financial?.total_pending_due),
        grossProfit: toNumber(financial?.gross_profit),
        details: row.details ?? "",
      } satisfies ProjectRow
    })

    const clients = clientRows
      .map((row) => ({
        id: row.id,
        displayName: clientDisplayName(row.person_name, row.company_name),
      }))
      .sort((a, b) => {
        const byName = a.displayName.localeCompare(b.displayName, "en", {
          sensitivity: "base",
        })
        if (byName !== 0) {
          return byName
        }
        return a.id.localeCompare(b.id)
      })

    return {
      projects,
      clients,
      projectTypes: catalogOptions(typeRows),
      projectPhases: catalogOptions(phaseRows),
      error: null,
    }
  } catch {
    return {
      projects: [],
      clients: [],
      projectTypes: [],
      projectPhases: [],
      error: "Could not load projects.",
    }
  }
}

function catalogOptions(
  rows: readonly { id: string; name: string }[],
): CatalogOption[] {
  const seen = new Set<string>()
  const options: CatalogOption[] = []

  for (const row of rows) {
    const name = row.name.trim()
    if (!name || seen.has(name)) {
      continue
    }

    seen.add(name)
    options.push({ id: row.id, name })
  }

  return options
}

async function fetchPages<T>(
  queryPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: { message: string } | null
  }>,
): Promise<T[]> {
  const rows: T[] = []

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE
    const { data, error } = await queryPage(from, from + PAGE_SIZE - 1)

    if (error) {
      throw error
    }

    const batch = data ?? []
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) {
      return rows
    }
  }

  throw new Error("Project list is larger than expected.")
}
