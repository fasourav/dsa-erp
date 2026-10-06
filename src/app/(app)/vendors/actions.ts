"use server"

import { revalidatePath } from "next/cache"

import {
  escapeLikePattern,
  hasMinDigits,
  isValidEmail,
  normalizePhoneDigits,
} from "@/lib/client-validation"
import { nextSortOrder } from "@/lib/lookup-catalogs"
import { createClient } from "@/lib/supabase/server"
import {
  isVendorKind,
  mergeCategorySuggestions,
  type VendorKind,
} from "@/lib/vendor-summary"

const vendorIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NAME_DUPLICATE_MESSAGE =
  "A vendor with this name and phone already exists."

export type DeleteVendorResult = {
  error: string | null
}

export type VendorFormInput = {
  kind: VendorKind
  name: string
  vendorField: string
  email: string
  phone: string
  notes: string
}

export type VendorFormFieldErrors = {
  kind?: string
  name?: string
  email?: string
  phone?: string
}

export type VendorFormResult = {
  error: string | null
  fieldErrors?: VendorFormFieldErrors
}

export type VendorCategoryOptionsResult = {
  categories: string[] | null
}

export async function loadVendorCategoryOptions(): Promise<VendorCategoryOptionsResult> {
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { categories: null }
  }

  const [categoriesResult, fieldsResult] = await Promise.all([
    supabase
      .from("vendor_work_categories")
      .select("name, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase.from("vendors").select("vendor_field"),
  ])

  if (categoriesResult.error) {
    return { categories: null }
  }

  return {
    categories: mergeCategorySuggestions(
      (categoriesResult.data ?? []).map((row) => row.name),
      fieldsResult.error
        ? []
        : (fieldsResult.data ?? []).map((row) => row.vendor_field),
    ),
  }
}

export async function addVendor(
  input: VendorFormInput,
): Promise<VendorFormResult> {
  return saveVendor(null, input)
}

export async function updateVendor(
  id: string,
  input: VendorFormInput,
): Promise<VendorFormResult> {
  if (!vendorIdPattern.test(id)) {
    return { error: "That vendor could not be found." }
  }

  return saveVendor(id, input)
}

async function saveVendor(
  id: string | null,
  input: VendorFormInput,
): Promise<VendorFormResult> {
  const { kind } = input

  if (!isVendorKind(kind)) {
    return {
      error: null,
      fieldErrors: { kind: "Choose Private or Company." },
    }
  }

  const name = input.name.trim()
  const vendorField = input.vendorField.trim()
  const email = input.email.trim()
  const phone = input.phone.trim()
  const notes = input.notes.trim()

  if (!name) {
    return {
      error: null,
      fieldErrors: {
        name:
          kind === "company"
            ? "Enter the company name."
            : "Enter the vendor name.",
      },
    }
  }

  if (email && !isValidEmail(email)) {
    return {
      error: null,
      fieldErrors: { email: "Enter a valid email address." },
    }
  }

  if (phone && !hasMinDigits(phone, 11)) {
    return {
      error: null,
      fieldErrors: {
        phone: "Enter a phone number with at least 11 digits.",
      },
    }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const duplicate = await findNamePhoneDuplicate(supabase, id, kind, name, phone)

  if (duplicate === "error") {
    return { error: "Could not save this vendor." }
  }

  if (duplicate === "duplicate") {
    return {
      error: null,
      fieldErrors: { name: NAME_DUPLICATE_MESSAGE },
    }
  }

  if (vendorField) {
    const categorySaved = await ensureVendorWorkCategory(supabase, vendorField)

    if (!categorySaved) {
      return { error: "Could not save this vendor." }
    }
  }

  const values = {
    kind,
    person_name: kind === "private" ? name : null,
    company_name: kind === "company" ? name : null,
    vendor_field: vendorField || null,
    email: email || null,
    phone: phone || null,
    notes: notes || null,
  }

  const { data, error } = id
    ? await supabase.from("vendors").update(values).eq("id", id).select("id")
    : await supabase.from("vendors").insert(values).select("id")

  if (error) {
    if (error.code === "23505") {
      return {
        error: null,
        fieldErrors: { name: NAME_DUPLICATE_MESSAGE },
      }
    }

    return { error: "Could not save this vendor." }
  }

  if (!data || data.length === 0) {
    return { error: "That vendor could not be found." }
  }

  revalidateVendorSurfaces()
  return { error: null }
}

async function ensureVendorWorkCategory(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
): Promise<boolean> {
  const trimmed = name.trim()

  if (!trimmed) {
    return true
  }

  const { data, error } = await supabase
    .from("vendor_work_categories")
    .select("name, sort_order")

  if (error || !data) {
    return false
  }

  const key = trimmed.toLowerCase()
  const exists = data.some((row) => row.name.trim().toLowerCase() === key)

  if (exists) {
    return true
  }

  const { error: insertError } = await supabase
    .from("vendor_work_categories")
    .insert({
      name: trimmed,
      sort_order: nextSortOrder(
        data.map((row) => ({ sortOrder: row.sort_order })),
      ),
    })

  if (!insertError) {
    return true
  }

  return isUniqueViolation(insertError)
}

function revalidateVendorSurfaces() {
  revalidatePath("/vendors")
  revalidatePath("/settings")
  revalidatePath("/purchase-orders")
}

function isUniqueViolation(error: { code?: string; message?: string }) {
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "")
}

async function findNamePhoneDuplicate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string | null,
  kind: VendorKind,
  name: string,
  phone: string,
): Promise<"duplicate" | "clear" | "error"> {
  const column = kind === "company" ? "company_name" : "person_name"
  let query = supabase
    .from("vendors")
    .select("phone")
    .eq("kind", kind)
    .ilike(column, escapeLikePattern(name))

  if (id) {
    query = query.neq("id", id)
  }

  const { data, error } = await query

  if (error) {
    return "error"
  }

  const normalizedPhone = normalizePhoneDigits(phone)
  const duplicate = (data ?? []).some((row) =>
    phonesMatch(normalizedPhone, row.phone),
  )

  return duplicate ? "duplicate" : "clear"
}

function phonesMatch(normalizedPhone: string, stored: string | null): boolean {
  const rowPhone = stored?.trim() ?? ""

  if (!normalizedPhone) {
    return rowPhone === ""
  }

  return rowPhone !== "" && normalizePhoneDigits(rowPhone) === normalizedPhone
}

export async function deleteVendor(id: string): Promise<DeleteVendorResult> {
  if (!vendorIdPattern.test(id)) {
    return { error: "That vendor could not be found." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("vendors")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return {
        error:
          "This vendor is linked to purchase orders and cannot be deleted.",
      }
    }

    return { error: "Could not delete this vendor." }
  }

  if (!data || data.length === 0) {
    return { error: "That vendor could not be found." }
  }

  revalidatePath("/vendors")
  return { error: null }
}
