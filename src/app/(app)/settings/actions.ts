"use server"

import { revalidatePath } from "next/cache"

import { revalidateSettings } from "@/lib/revalidate-settings"

import { friendlyDbError } from "@/lib/db-errors"
import { phaseProgressPercent } from "@/lib/project-progress"
import { createClient } from "@/lib/supabase/server"
import { denyUnlessOwner } from "@/lib/permissions"
import {
  catalogByKey,
  duplicateNameMessage,
  isCatalogKey,
  isSortOrder,
  slugifyCatalogCode,
  type CatalogKey,
} from "@/lib/lookup-catalogs"
import { isReportGroup, type ReportGroup } from "@/lib/report-cost-group"

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SharedCatalog = Exclude<CatalogKey, "departments" | "lead_statuses">

export type CatalogFieldErrors = {
  name?: string
  sortOrder?: string
  isActive?: string
  code?: string
  isOpen?: string
  reportGroup?: string
}

export type CatalogActionResult = {
  error: string | null
  fieldErrors?: CatalogFieldErrors
}

export type CatalogItemInput = {
  catalog: string
  name: string
  sortOrder: number
  isActive: boolean
  code?: string
  isOpen?: boolean
  reportGroup?: string
}

export async function addCatalogItem(
  input: CatalogItemInput,
): Promise<CatalogActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }
  return saveCatalogItem(null, input)
}

export async function updateCatalogItem(
  id: string,
  input: CatalogItemInput,
): Promise<CatalogActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }
  return saveCatalogItem(id, input)
}

export async function deleteCatalogItem(
  catalog: string,
  id: string,
): Promise<CatalogActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }
  if (!isCatalogKey(catalog)) {
    return { error: "That list could not be found." }
  }

  if (!idPattern.test(id)) {
    return { error: "That item could not be found." }
  }

  const supabase = await createClient()
  const signedIn = await isSignedIn(supabase)

  if (!signedIn) {
    return { error: "You must be signed in." }
  }

  if (catalog === "lead_statuses") {
    const blocked = await leadStatusInUse(supabase, id)
    if (blocked === "error") {
      return { error: "Could not delete this item." }
    }
    if (blocked === "in_use") {
      return { error: "This item is still in use and cannot be deleted." }
    }
  }

  const { data, error } = await supabase
    .from(catalog)
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (isForeignKeyViolation(error)) {
      return { error: "This item is still in use and cannot be deleted." }
    }

    return { error: "Could not delete this item." }
  }

  if (!data || data.length === 0) {
    return { error: "That item could not be found." }
  }

  if (catalog === "project_phases") {
    await syncAllProjectPhaseProgress(supabase)
  }

  revalidateCatalogs(catalog)
  return { error: null }
}

async function saveCatalogItem(
  id: string | null,
  input: CatalogItemInput,
): Promise<CatalogActionResult> {
  if (!isCatalogKey(input.catalog)) {
    return { error: "That list could not be found." }
  }

  if (id && !idPattern.test(id)) {
    return { error: "That item could not be found." }
  }

  const name = input.name.trim()
  const fieldErrors: CatalogFieldErrors = {}

  if (!name) {
    fieldErrors.name = "Enter a name."
  }

  if (!isSortOrder(input.sortOrder)) {
    fieldErrors.sortOrder = "Enter a whole number."
  }

  const definition = catalogByKey(input.catalog)

  if (definition.hasActive && typeof input.isActive !== "boolean") {
    fieldErrors.isActive = "Choose whether this department is active."
  }

  let code = (input.code ?? "").trim().toLowerCase()
  if (definition.hasCode) {
    if (!code) {
      code = slugifyCatalogCode(name)
    }
    if (!code || !/^[a-z][a-z0-9_]*$/.test(code)) {
      fieldErrors.name = "Enter a name that can be saved as a status."
    }
  }

  let reportGroup: ReportGroup | null = null
  if (definition.hasReportGroup) {
    reportGroup = isReportGroup(input.reportGroup) ? input.reportGroup : null
    if (!reportGroup) {
      fieldErrors.reportGroup = "Choose a report group."
    }
  }

  if (
    fieldErrors.name ||
    fieldErrors.sortOrder ||
    fieldErrors.isActive ||
    fieldErrors.code ||
    fieldErrors.isOpen ||
    fieldErrors.reportGroup
  ) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const signedIn = await isSignedIn(supabase)

  if (!signedIn) {
    return { error: "You must be signed in." }
  }

  const sortOrder = input.sortOrder

  if (input.catalog === "lead_statuses" && !id) {
    code = await uniqueLeadStatusCode(supabase, code)
  }

  const { data, error } =
    input.catalog === "departments"
      ? await writeDepartment(supabase, id, {
          name,
          sort_order: sortOrder,
          is_active: input.isActive,
        })
      : input.catalog === "lead_statuses"
        ? await writeLeadStatus(supabase, id, {
            name,
            sort_order: sortOrder,
            code,
          })
        : input.catalog === "office_expense_categories"
          ? await writeOfficeCategory(supabase, id, {
              name,
              sort_order: sortOrder,
              report_group: reportGroup ?? "operational",
            })
          : await writeShared(supabase, input.catalog, id, {
              name,
              sort_order: sortOrder,
            })

  if (error) {
    if (isUniqueViolation(error)) {
      // Code is auto-generated; surface collisions as a name problem for users.
      return {
        error: null,
        fieldErrors: {
          name: duplicateNameMessage(definition.singular),
        },
      }
    }

    return { error: friendlyDbError(error, "Could not save this item.") }
  }

  if (!data || data.length === 0) {
    return { error: "That item could not be found." }
  }

  if (input.catalog === "project_phases") {
    await syncAllProjectPhaseProgress(supabase)
  }

  revalidateCatalogs(input.catalog)
  return { error: null }
}

async function syncAllProjectPhaseProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const [phases, projects] = await Promise.all([
    supabase
      .from("project_phases")
      .select("name, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("projects")
      .select("id, current_phase, progress_percent"),
  ])

  if (phases.error || projects.error || !phases.data || !projects.data) {
    return
  }

  await Promise.all(
    projects.data.map(async (project) => {
      const nextPercent = phaseProgressPercent(project.current_phase, phases.data)
      if (Number(project.progress_percent ?? 0) === nextPercent) return
      await supabase
        .from("projects")
        .update({ progress_percent: nextPercent })
        .eq("id", project.id)
    }),
  )
}

async function writeDepartment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string | null,
  row: { name: string; sort_order: number; is_active: boolean },
) {
  if (id) {
    return supabase.from("departments").update(row).eq("id", id).select("id")
  }

  return supabase.from("departments").insert(row).select("id")
}

async function writeOfficeCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string | null,
  row: { name: string; sort_order: number; report_group: ReportGroup },
) {
  if (id) {
    return supabase.from("office_expense_categories").update(row).eq("id", id).select("id")
  }

  return supabase.from("office_expense_categories").insert(row).select("id")
}

async function writeShared(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: SharedCatalog,
  id: string | null,
  row: { name: string; sort_order: number },
) {
  if (id) {
    return supabase.from(table).update(row).eq("id", id).select("id")
  }

  return supabase.from(table).insert(row).select("id")
}

async function writeLeadStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string | null,
  row: {
    name: string
    sort_order: number
    code: string
  },
) {
  if (id) {
    // Preserve code and is_open; Settings only edits name + sort order.
    return supabase
      .from("lead_statuses")
      .update({
        name: row.name,
        sort_order: row.sort_order,
      })
      .eq("id", id)
      .select("id")
  }

  // New custom statuses default to open in the DB without exposing that in UI.
  return supabase
    .from("lead_statuses")
    .insert({
      name: row.name,
      sort_order: row.sort_order,
      code: row.code,
      is_open: true,
    })
    .select("id")
}

async function uniqueLeadStatusCode(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseCode: string,
) {
  const { data, error } = await supabase.from("lead_statuses").select("code")

  if (error || !data) {
    return baseCode
  }

  const existing = new Set(
    data.map((row) => String(row.code ?? "").toLowerCase()),
  )

  if (!existing.has(baseCode)) {
    return baseCode
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseCode}_${index}`
    if (!existing.has(candidate)) {
      return candidate
    }
  }

  return `${baseCode}_${Date.now()}`
}

async function leadStatusInUse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<"in_use" | "clear" | "error"> {
  const { data, error } = await supabase
    .from("lead_statuses")
    .select("code")
    .eq("id", id)
    .limit(1)

  if (error || !data || data.length === 0) {
    return "error"
  }

  const code = data[0].code
  const { count, error: leadError } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("status", code)

  if (leadError) {
    return "error"
  }

  return (count ?? 0) > 0 ? "in_use" : "clear"
}

async function isSignedIn(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.getUser()
  return !error && Boolean(data.user)
}

function revalidateCatalogs(catalog: CatalogKey) {
  revalidateSettings(catalog)
  revalidatePath("/projects")

  if (
    catalog === "lead_sources" ||
    catalog === "lead_stages" ||
    catalog === "lead_statuses"
  ) {
    revalidatePath("/leads")
  }

  if (catalog === "vendor_work_categories") {
    revalidatePath("/vendors")
    revalidatePath("/purchase-orders")
  }

  if (catalog === "office_expense_categories") {
    revalidatePath("/accounts/expenses")
    revalidatePath("/purchase-orders")
    revalidatePath("/dashboard")
    revalidatePath("/reports", "layout")
  }

  if (catalog === "asset_categories") {
    revalidatePath("/assets")
  }
}

function isUniqueViolation(error: { code?: string; message?: string }) {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "")
}

function isForeignKeyViolation(error: { code?: string; message?: string }) {
  return error.code === "23503" || /foreign key/i.test(error.message ?? "")
}