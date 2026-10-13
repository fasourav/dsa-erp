"use server"

import { revalidatePath } from "next/cache"

import { dbIssue, friendlyDbError } from "@/lib/db-errors"
import { denyUnless } from "@/lib/permissions"
import { firstIssue, purchaseOrderValueSchema } from "@/lib/schemas"
import {
  isIsoDate,
  parseProjectValue,
} from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import { cleanUpDeletedAttachmentFiles } from "@/lib/attachment-files"

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type PurchaseOrderFormInput = {
  projectId: string
  vendorId: string
  issuedOn: string
  workType: string
  totalValue: string
  notes: string
}

export type PurchaseOrderFormFieldErrors = {
  projectId?: string
  vendorId?: string
  issuedOn?: string
  totalValue?: string
}

export type PurchaseOrderFormResult = {
  error: string | null
  fieldErrors?: PurchaseOrderFormFieldErrors
}

export type DeletePurchaseOrderResult = {
  error: string | null
}

export async function addPurchaseOrder(
  input: PurchaseOrderFormInput,
): Promise<PurchaseOrderFormResult> {
  const denied = await denyUnless("purchase_orders", "add")
  if (denied) return { error: denied }
  return savePurchaseOrder(null, input)
}

export async function updatePurchaseOrder(
  id: string,
  input: PurchaseOrderFormInput,
): Promise<PurchaseOrderFormResult> {
  const denied = await denyUnless("purchase_orders", "edit")
  if (denied) return { error: denied }
  if (!idPattern.test(id)) {
    return { error: "That purchase order could not be found." }
  }

  return savePurchaseOrder(id, input)
}

async function savePurchaseOrder(
  id: string | null,
  input: PurchaseOrderFormInput,
): Promise<PurchaseOrderFormResult> {
  const projectId = input.projectId.trim()
  const operational = projectId.length === 0
  const vendorId = input.vendorId.trim()
  const issuedOn = input.issuedOn.trim()
  const workType = input.workType.trim()
  const notes = input.notes.trim()
  const totalValue = parseProjectValue(input.totalValue)
  const fieldErrors: PurchaseOrderFormFieldErrors = {}

  if (!operational && !idPattern.test(projectId)) {
    fieldErrors.projectId = "Choose a project."
  }

  if (!idPattern.test(vendorId)) {
    fieldErrors.vendorId = "Choose a vendor."
  }

  if (!isIsoDate(issuedOn)) {
    fieldErrors.issuedOn = "Enter a date."
  }

  if (totalValue === null || totalValue <= 0) {
    fieldErrors.totalValue = input.totalValue.trim()
      ? "Enter an amount greater than 0."
      : "Enter a purchase order value."
  }

  const valueCheck = purchaseOrderValueSchema.safeParse({ totalValue: input.totalValue })
  if (!valueCheck.success && !fieldErrors.totalValue) {
    fieldErrors.totalValue = firstIssue(valueCheck.error, "totalValue")
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const [projectLookup, vendorLookup] = await Promise.all([
    operational
      ? Promise.resolve({ data: [{ id: "" }], error: null })
      : supabase.from("projects").select("id").eq("id", projectId).limit(1),
    supabase.from("vendors").select("id").eq("id", vendorId).limit(1),
  ])

  if (projectLookup.error || vendorLookup.error) {
    return { error: "Could not save this purchase order." }
  }

  if (!operational && (!projectLookup.data || projectLookup.data.length === 0)) {
    return {
      error: null,
      fieldErrors: { projectId: "Choose a project." },
    }
  }

  if (!vendorLookup.data || vendorLookup.data.length === 0) {
    return {
      error: null,
      fieldErrors: { vendorId: "Choose a vendor." },
    }
  }

  const values = {
    project_id: operational ? null : projectId,
    vendor_id: vendorId,
    issued_on: issuedOn,
    work_type: workType || null,
    total_value: totalValue ?? 0,
    notes: notes || null,
  }

  const { data, error } = id
    ? await supabase
        .from("vendor_purchase_orders")
        .update(values)
        .eq("id", id)
        .select("id")
    : await supabase
        .from("vendor_purchase_orders")
        .insert(values)
        .select("id")

  if (error) {
    if (error.code === "23503") {
      if (/vendor/i.test(error.message)) {
        return {
          error: null,
          fieldErrors: { vendorId: "Choose a vendor." },
        }
      }

      return {
        error: null,
        fieldErrors: { projectId: "Choose a project." },
      }
    }

    if (error.code === "23514" && dbIssue(error)?.message === "This value is not allowed.") {
      return {
        error: null,
        fieldErrors: {
          totalValue: "Enter an amount greater than 0.",
        },
      }
    }

    return { error: friendlyDbError(error, "Could not save this purchase order.") }
  }

  if (!data || data.length === 0) {
    return { error: "That purchase order could not be found." }
  }

  revalidatePurchaseOrders()
  return { error: null }
}

export async function deletePurchaseOrder(
  id: string,
): Promise<DeletePurchaseOrderResult> {
  const denied = await denyUnless("purchase_orders", "delete")
  if (denied) return { error: denied }
  if (!idPattern.test(id)) {
    return { error: "That purchase order could not be found." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("vendor_purchase_orders")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return {
        error:
          "This purchase order has vendor payments and cannot be deleted.",
      }
    }

    return { error: "Could not delete this purchase order." }
  }

  if (!data || data.length === 0) {
    return { error: "That purchase order could not be found." }
  }

  cleanUpDeletedAttachmentFiles()
  revalidatePurchaseOrders()
  return { error: null }
}

function revalidatePurchaseOrders() {
  revalidatePath("/purchase-orders")
  revalidatePath("/accounts/payable")
  revalidatePath("/vendors")
  revalidatePath("/projects")
}
