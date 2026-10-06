"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import { parseProjectValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export type BudgetInput = {
  departmentId: string
  periodYear: string
  periodMonth: string
  allocatedBudget: string
  notes: string
}

export type BudgetFieldErrors = {
  departmentId?: string
  periodYear?: string
  periodMonth?: string
  allocatedBudget?: string
}

export type BudgetResult = {
  error: string | null
  fieldErrors?: BudgetFieldErrors
}

export type DeleteResult = {
  error: string | null
}

export async function addBudget(input: BudgetInput): Promise<BudgetResult> {
  return saveBudget(null, input)
}

export async function updateBudget(
  id: string,
  input: BudgetInput,
): Promise<BudgetResult> {
  if (!isUuid(id)) return { error: "That budget could not be found." }
  return saveBudget(id, input)
}

export async function deleteBudget(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) return { error: "That budget could not be found." }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const { data, error } = await supabase
    .from("budgets")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) return { error: "Could not delete this budget." }
  if (!data || data.length === 0)
    return { error: "That budget could not be found." }

  revalidatePath("/accounts/budgets")
  return { error: null }
}

async function saveBudget(
  id: string | null,
  input: BudgetInput,
): Promise<BudgetResult> {
  const departmentId = input.departmentId.trim()
  const year = parseInt(input.periodYear, 10)
  const month = parseInt(input.periodMonth, 10)
  const allocatedBudget = parseProjectValue(input.allocatedBudget)
  const notes = input.notes.trim()
  const fieldErrors: BudgetFieldErrors = {}

  if (!isUuid(departmentId)) fieldErrors.departmentId = "Choose a department."
  if (!Number.isFinite(year) || year < 2000 || year > 2100)
    fieldErrors.periodYear = "Enter a valid year."
  if (!Number.isFinite(month) || month < 1 || month > 12)
    fieldErrors.periodMonth = "Enter a valid month."
  if (allocatedBudget === null || allocatedBudget < 0)
    fieldErrors.allocatedBudget = "Enter a budget amount."

  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const values = {
    department_id: departmentId,
    period_year: year,
    period_month: month,
    allocated_budget: allocatedBudget ?? 0,
    notes: notes || null,
  }

  const { data, error } = id
    ? await supabase.from("budgets").update(values).eq("id", id).select("id")
    : await supabase.from("budgets").insert(values).select("id")

  if (error) {
    if (error.code === "23505") {
      return {
        error: "A budget for this department and period already exists.",
      }
    }
    if (error.code === "23503") return { error: "Choose a valid department." }
    return { error: "Could not save this budget." }
  }
  if (!data || data.length === 0)
    return { error: "That budget could not be found." }

  revalidatePath("/accounts/budgets")
  return { error: null }
}
