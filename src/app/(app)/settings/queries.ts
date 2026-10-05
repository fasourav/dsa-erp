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
] as const satisfies readonly Exclude<CatalogKey, "departments">[]

type SharedCatalog = (typeof sharedCatalogs)[number]

export async function getLookupCatalogs(): Promise<LookupCatalogsResult> {
  const supabase = await createClient()

  const [departments, ...shared] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name, sort_order, is_active")
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
      departments.data.map((row) => toItem(row, row.is_active)),
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
      result.data.map((row) => toItem(row, null)),
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
): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive,
  }
}
