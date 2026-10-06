"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import { isIsoDate, parseProjectValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export type AssetInput = {
  purchaseDate: string
  name: string
  category: string
  quantity: string
  unitCost: string
  lifespanYears: string
  notes: string
}

export type AssetFieldErrors = {
  purchaseDate?: string
  name?: string
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
  return saveAsset(null, input)
}

export async function updateAsset(
  id: string,
  input: AssetInput,
): Promise<AssetResult> {
  if (!isUuid(id)) return { error: "That asset could not be found." }
  return saveAsset(id, input)
}

export async function deleteAsset(id: string): Promise<DeleteResult> {
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
  const category = input.category.trim()
  const purchaseDate = input.purchaseDate.trim()
  const notes = input.notes.trim()
  const quantity = parseInt(input.quantity.trim(), 10)
  const unitCost = parseProjectValue(input.unitCost)
  const lifespanYears = parseInt(input.lifespanYears.trim(), 10)
  const fieldErrors: AssetFieldErrors = {}

  if (!name) fieldErrors.name = "Enter an asset name."
  if (!isIsoDate(purchaseDate))
    fieldErrors.purchaseDate = "Enter a purchase date."
  if (!Number.isFinite(quantity) || quantity < 1)
    fieldErrors.quantity = "Enter a quantity of at least 1."
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
    category: category || null,
    purchase_date: purchaseDate,
    quantity,
    unit_cost: unitCost ?? 0,
    lifespan_years: lifespanYears,
    notes: notes || null,
  }

  const { data, error } = id
    ? await supabase.from("assets").update(values).eq("id", id).select("id")
    : await supabase.from("assets").insert(values).select("id")

  if (error) return { error: "Could not save this asset." }
  if (!data || data.length === 0)
    return { error: "That asset could not be found." }

  revalidatePath("/assets")
  return { error: null }
}
