import { createClient } from "@/lib/supabase/server"
import {
  catalogDefinitions,
  type CatalogItem,
  type CatalogKey,
  type CatalogList,
} from "@/lib/lookup-catalogs"

export type LookupCatalogsResult = {
  catalogs: CatalogList[]
  error: string | null
}

const sharedCatalogs = [
  "project_types",
  "project_phases",
  "office_expense_categories",
  "project_expense_categories",
  "payment_methods",
  "vendor_work_categories",
  "lead_sources",
  "lead_stages",
] as const satisfies readonly Exclude<
  CatalogKey,
  "departments" | "lead_statuses"
>[]

type SharedCatalog = (typeof sharedCatalogs)[number]

export async function getLookupCatalogs(): Promise<LookupCatalogsResult> {
  const supabase = await createClient()

  const [departments, statuses, ...shared] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, sort_order, is_active")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("lead_statuses")
      .select("id, name, sort_order, code, is_open")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    ...sharedCatalogs.map((table) => loadShared(supabase, table)),
  ])

  const rows = new Map<CatalogKey, CatalogItem[]>()
  let failed = false

  if (departments.error || !departments.data) {
    failed = true
    rows.set("departments", [])
  } else {
    rows.set(
      "departments",
      departments.data.map((row) =>
        toItem(row, row.is_active, null, null),
      ),
    )
  }

  if (statuses.error || !statuses.data) {
    failed = true
    rows.set("lead_statuses", [])
  } else {
    rows.set(
      "lead_statuses",
      statuses.data.map((row) =>
        toItem(row, null, row.code, Boolean(row.is_open)),
      ),
    )
  }

  shared.forEach((result, index) => {
    const key = sharedCatalogs[index]

    if (result.error || !result.data) {
      failed = true
      rows.set(key, [])
      return
    }

    rows.set(
      key,
      result.data.map((row) => toItem(row, null, null, null)),
    )
  })

  return {
    catalogs: catalogDefinitions.map((definition) => ({
      ...definition,
      items: rows.get(definition.key) ?? [],
    })),
    error: failed ? "Could not load lookup catalogs." : null,
  }
}

function loadShared(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: SharedCatalog,
) {
  return supabase
    .from(table)
    .select("id, name, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
}

function toItem(
  row: { id: string; name: string; sort_order: number },
  isActive: boolean | null,
  code: string | null,
  isOpen: boolean | null,
): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive,
    code,
    isOpen,
  }
}
