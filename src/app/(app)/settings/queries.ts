import { createClient } from "@/lib/supabase/server"
import {
  catalogDefinitions,
  type CatalogItem,
  type CatalogKey,
  type CatalogList,
} from "@/lib/lookup-catalogs"
import { isReportGroup, type ReportGroup } from "@/lib/report-cost-group"

export type LookupCatalogsResult = {
  catalogs: CatalogList[]
  error: string | null
}

export type LastBackupStatus = {
  ranAtLabel: string
  sizeLabel: string
  status: string
} | null

const sharedCatalogs = [
  "project_types",
  "project_phases",
  "project_expense_categories",
  "payment_methods",
  "vendor_work_categories",
  "lead_sources",
  "lead_stages",
  "asset_categories",
] as const satisfies readonly Exclude<
  CatalogKey,
  "departments" | "lead_statuses" | "office_expense_categories"
>[]

type SharedCatalog = (typeof sharedCatalogs)[number]

export async function getLookupCatalogs(): Promise<LookupCatalogsResult> {
  const supabase = await createClient()

  const [departments, statuses, officeCategories, ...shared] = await Promise.all([
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
    supabase
      .from("office_expense_categories")
      .select("id, name, sort_order, report_group")
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
        toItem(row, row.is_active, null, null, null),
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
        toItem(row, null, row.code, Boolean(row.is_open), null),
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
      result.data.map((row) => toItem(row, null, null, null, null)),
    )
  })

  if (officeCategories.error || !officeCategories.data) {
    failed = true
    rows.set("office_expense_categories", [])
  } else {
    rows.set(
      "office_expense_categories",
      officeCategories.data.map((row) =>
        toItem(row, null, null, null, isReportGroup(row.report_group) ? row.report_group : null),
      ),
    )
  }

  return {
    catalogs: catalogDefinitions.map((definition) => ({
      ...definition,
      items: rows.get(definition.key) ?? [],
    })),
    error: failed ? "Could not load lookup catalogs." : null,
  }
}

export async function getLastBackupStatus(): Promise<LastBackupStatus> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("backup_runs")
    .select("ran_at, size_bytes, status")
    .order("ran_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null

  return {
    ranAtLabel: formatBackupWhen(data.ran_at),
    sizeLabel: formatBackupSize(data.size_bytes),
    status: data.status,
  }
}

function formatBackupWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

function formatBackupSize(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  reportGroup: ReportGroup | null,
): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    isActive,
    code,
    isOpen,
    reportGroup,
  }
}
