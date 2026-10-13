"use server"

import { revalidatePath } from "next/cache"

import { friendlyDbError } from "@/lib/db-errors"
import { isUuid } from "@/lib/ids"
import { assetQuantitySchema, firstIssue } from "@/lib/schemas"
import { isIsoDate, parseProjectValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import { denyUnless } from "@/lib/permissions"

export type AssetInput = {
  purchaseDate: string
  name: string
  categoryId: string
  quantity: string
  unitCost: string
  lifespanYears: string
  notes: string
}

export type AssetFieldErrors = {
  purchaseDate?: string
  name?: string
  categoryId?: string
  quantity?: string
  unitCost?: string
  lifespanYears?: string
}

export type AssetResult = {
  error: string | null
  fieldErrors?: AssetFieldErrors
}

export type DeleteResult = {
  error: string | null
}

export async function addAsset(input: AssetInput): Promise<AssetResult> {
  const denied = await denyUnless("assets", "add")
  if (denied) return { error: denied }
  return saveAsset(null, input)
}

export async function updateAsset(
  id: string,
  input: AssetInput,
): Promise<AssetResult> {
  const denied = await denyUnless("assets", "edit")
  if (denied) return { error: denied }
  if (!isUuid(id)) return { error: "That asset could not be found." }
  return saveAsset(id, input)
}

export async function deleteAsset(id: string): Promise<DeleteResult> {
  const denied = await denyUnless("assets", "delete")
  if (denied) return { error: denied }
  if (!isUuid(id)) return { error: "That asset could not be found." }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const { data, error } = await supabase
    .from("assets")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) return { error: "Could not delete this asset." }
  if (!data || data.length === 0)
    return { error: "That asset could not be found." }

  revalidatePath("/assets")
  return { error: null }
}

async function saveAsset(
  id: string | null,
  input: AssetInput,
): Promise<AssetResult> {
  const name = input.name.trim()
  const categoryId = input.categoryId.trim()
  const purchaseDate = input.purchaseDate.trim()
  const notes = input.notes.trim()
  const quantityCheck = assetQuantitySchema.safeParse({ quantity: input.quantity })
  const quantity = quantityCheck.success ? Number(input.quantity.trim()) : Number.NaN
  const unitCost = parseProjectValue(input.unitCost)
  const lifespanYears = parseInt(input.lifespanYears.trim(), 10)
  const fieldErrors: AssetFieldErrors = {}

  if (!name) fieldErrors.name = "Enter an asset name."
  if (!isIsoDate(purchaseDate))
    fieldErrors.purchaseDate = "Enter a purchase date."
  if (!quantityCheck.success) {
    fieldErrors.quantity = firstIssue(quantityCheck.error, "quantity")
  }
  if (categoryId && !isUuid(categoryId)) {
    fieldErrors.categoryId = "Choose a category."
  }
  if (unitCost === null || unitCost < 0)
    fieldErrors.unitCost = "Enter a unit cost."
  if (!Number.isFinite(lifespanYears) || lifespanYears < 1)
    fieldErrors.lifespanYears = "Enter a lifespan of at least 1 year."

  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const values = {
    name,
    category_id: categoryId || null,
    purchase_date: purchaseDate,
    quantity,
    unit_cost: unitCost ?? 0,
    lifespan_years: lifespanYears,
    notes: notes || null,
  }

  const { data, error } = id
    ? await supabase.from("assets").update(values).eq("id", id).select("id")
    : await supabase.from("assets").insert(values).select("id")

  if (error) return { error: friendlyDbError(error, "Could not save this asset.") }
  if (!data || data.length === 0)
    return { error: "That asset could not be found." }

  revalidatePath("/assets")
  return { error: null }
}
