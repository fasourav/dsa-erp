"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import {
  catalogByKey,
  duplicateNameMessage,
  isCatalogKey,
  isSortOrder,
  type CatalogKey,
} from "@/lib/lookup-catalogs"

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SharedCatalog = Exclude<CatalogKey, "departments">

export type CatalogFieldErrors = {
  name?: string
  sortOrder?: string
  isActive?: string
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
}

export async function addCatalogItem(
  input: CatalogItemInput,
): Promise<CatalogActionResult> {
  return saveCatalogItem(null, input)
}

export async function updateCatalogItem(
  id: string,
  input: CatalogItemInput,
): Promise<CatalogActionResult> {
  return saveCatalogItem(id, input)
}

export async function deleteCatalogItem(
  catalog: string,
  id: string,
): Promise<CatalogActionResult> {
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

  revalidateCatalogs()
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

  if (fieldErrors.name || fieldErrors.sortOrder || fieldErrors.isActive) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const signedIn = await isSignedIn(supabase)

  if (!signedIn) {
    return { error: "You must be signed in." }
  }

  const sortOrder = input.sortOrder
  const { data, error } =
    input.catalog === "departments"
      ? await writeDepartment(supabase, id, {
          name,
          sort_order: sortOrder,
          is_active: input.isActive,
        })
      : await writeShared(supabase, input.catalog, id, {
          name,
          sort_order: sortOrder,
        })

  if (error) {
    if (isUniqueViolation(error)) {
      return {
        error: null,
        fieldErrors: { name: duplicateNameMessage(definition.singular) },
      }
    }

    return { error: "Could not save this item." }
  }

  if (!data || data.length === 0) {
    return { error: "That item could not be found." }
  }

  revalidateCatalogs()
  return { error: null }
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

async function isSignedIn(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.getUser()
  return !error && Boolean(data.user)
}

function revalidateCatalogs() {
  revalidatePath("/settings")
  revalidatePath("/projects")
}

function isUniqueViolation(error: { code?: string; message?: string }) {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "")
}

function isForeignKeyViolation(error: { code?: string; message?: string }) {
  return error.code === "23503" || /foreign key/i.test(error.message ?? "")
}
