"use server"

import { titleCaseName } from "@/lib/format"
import { missedUpdateMessage, staleWriteMessage } from "@/lib/record-version"
import { revalidatePath } from "next/cache"

import { friendlyDbError, isUniqueViolation } from "@/lib/db-errors"
import { denyUnless } from "@/lib/permissions"
import { revalidateSettings } from "@/lib/revalidate-settings"
import {
  escapeLikePattern,
  isValidEmail,
} from "@/lib/client-validation"
import { phoneErrorForStored, phoneMatchKey, toE164FromStored } from "@/lib/phone"
import { getCurrentUser } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { cleanUpDeletedAttachmentFiles } from "@/lib/attachment-files"
import {
  catalogCategoryOptions,
  isVendorKind,
  MISSING_VENDOR_VERSION_MESSAGE,
  ONLY_OWNERS_CATEGORY_MESSAGE,
  VENDOR_ADD_DENIED_MESSAGE,
  VENDOR_EDIT_DENIED_MESSAGE,
  type VendorKind,
} from "@/lib/vendor-summary"

const vendorIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const NAME_DUPLICATE_MESSAGE =
  "A vendor with this name already exists."

export type DeleteVendorResult = {
  error: string | null
}

export type VendorFormInput = {
  version?: string
  kind: VendorKind
  name: string
  vendorField: string
  email: string
  phone: string
  address: string
  notes: string
}

export type VendorFormFieldErrors = {
  kind?: string
  name?: string
  vendorField?: string
  email?: string
  phone?: string
}

export type VendorFormResult = {
  error: string | null
  fieldErrors?: VendorFormFieldErrors
}

export type VendorCategoryOptionsResult = {
  categories: string[] | null
  error?: string | null
}

export async function loadVendorCategoryOptions(): Promise<VendorCategoryOptionsResult> {
  const denied = await denyUnless("vendors", "view")
  if (denied) return { categories: null, error: denied }
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { categories: null, error: "You must be signed in." }
  }

  const categoriesResult = await supabase
    .from("vendor_work_categories")
    .select("name, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (categoriesResult.error) {
    return { categories: null, error: "Could not load vendor categories." }
  }

  return {
    categories: catalogCategoryOptions(
      (categoriesResult.data ?? []).map((row) => row.name),
    ),
    error: null,
  }
}

export async function addVendor(
  input: VendorFormInput,
): Promise<VendorFormResult> {
  const denied = await denyUnless("vendors", "add")
  if (denied) return { error: denied }
  return saveVendor(null, input)
}

export async function updateVendor(
  id: string,
  input: VendorFormInput,
): Promise<VendorFormResult> {
  const denied = await denyUnless("vendors", "edit")
  if (denied) return { error: denied }
  if (!vendorIdPattern.test(id)) {
    return { error: "That vendor could not be found." }
  }

  return saveVendor(id, input)
}

function isValidVersionTimestamp(value: string | undefined): value is string {
  const trimmed = value?.trim() ?? ""
  return trimmed.length > 0 && !Number.isNaN(Date.parse(trimmed))
}

async function saveVendor(
  id: string | null,
  input: VendorFormInput,
): Promise<VendorFormResult> {
  const version = input.version?.trim()
  if (id && !isValidVersionTimestamp(version)) {
    return { error: MISSING_VENDOR_VERSION_MESSAGE }
  }

  const { kind } = input

  if (!isVendorKind(kind)) {
    return {
      error: null,
      fieldErrors: { kind: "Choose Private or Company." },
    }
  }

  const name = titleCaseName(input.name)
  const vendorField = input.vendorField.trim()
  const email = input.email.trim()
  const phone = toE164FromStored(input.phone)
  const address = input.address.trim()
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

  const phoneError = phoneErrorForStored(input.phone)
  if (phoneError) {
    return {
      error: null,
      fieldErrors: {
        phone: phoneError,
      },
    }
  }

  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
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

  const { data, error } = await supabase.rpc("save_vendor", {
    p_id: id,
    p_version: id ? version : null,
    p_kind: kind,
    p_person_name: kind === "private" ? name : null,
    p_company_name: kind === "company" ? name : null,
    p_vendor_field: vendorField || null,
    p_email: email || null,
    p_phone: phone || null,
    p_address: address || null,
    p_notes: notes || null,
  })

  if (error) {
    const stale = staleWriteMessage(error)
    if (stale) return { error: stale }

    if (error.code === "P0002" || /could not be found/i.test(error.message ?? "")) {
      return { error: "That vendor could not be found." }
    }

    if (error.code === "42501") {
      const message = error.message ?? ""
      if (/only owners can add new vendor categories|vendor_work_categories/i.test(message)) {
        return {
          error: null,
          fieldErrors: { vendorField: ONLY_OWNERS_CATEGORY_MESSAGE },
        }
      }
      if (
        message === VENDOR_EDIT_DENIED_MESSAGE ||
        message === VENDOR_ADD_DENIED_MESSAGE
      ) {
        return { error: message }
      }
    }

    if (isUniqueViolation(error)) {
      return {
        error: null,
        fieldErrors: { name: NAME_DUPLICATE_MESSAGE },
      }
    }

    return { error: friendlyDbError(error, "Could not save this vendor.") }
  }

  const saved =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as { id?: string })
      : null

  if (!saved?.id) {
    return { error: missedUpdateMessage(id ? version : undefined, "That vendor could not be found.") }
  }

  revalidateVendorSurfaces()
  return { error: null }
}

function revalidateVendorSurfaces() {
  revalidatePath("/vendors")
  revalidateSettings("vendor_work_categories")
  revalidatePath("/purchase-orders")
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

  const normalizedPhone = phoneMatchKey(phone)
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

  return rowPhone !== "" && phoneMatchKey(rowPhone) === normalizedPhone
}

export async function deleteVendor(id: string): Promise<DeleteVendorResult> {
  const denied = await denyUnless("vendors", "delete")
  if (denied) return { error: denied }
  if (!vendorIdPattern.test(id)) {
    return { error: "That vendor could not be found." }
  }

  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
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

  cleanUpDeletedAttachmentFiles()
  revalidatePath("/vendors")
  return { error: null }
}
