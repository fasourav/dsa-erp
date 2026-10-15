"use server"

import { revalidatePath } from "next/cache"

import { dbIssue, friendlyDbError } from "@/lib/db-errors"
import { isUuid } from "@/lib/ids"
import { amountError, parseProjectValue } from "@/lib/project-validation"
import { denyUnless } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

export type BudgetLineInput = {
  projectId: string
  categoryId: string
  plannedAmount: string
  notes: string
}

export type BudgetLineFieldErrors = {
  categoryId?: string
  plannedAmount?: string
  notes?: string
}

export type BudgetLineResult = {
  error: string | null
  fieldErrors?: BudgetLineFieldErrors
}

export async function saveProjectBudgetLine(
  lineId: string | null,
  input: BudgetLineInput,
): Promise<BudgetLineResult> {
  const denied = await denyUnless("project_budgets", lineId ? "edit" : "add")
  if (denied) return { error: denied }

  const projectId = input.projectId.trim()
  const categoryId = input.categoryId.trim()
  const notes = input.notes.trim()
  const fieldErrors: BudgetLineFieldErrors = {}

  if (!isUuid(projectId)) return { error: "That project could not be found." }
  if (!isUuid(categoryId)) fieldErrors.categoryId = "Choose a category."
  if (!input.plannedAmount.trim()) {
    fieldErrors.plannedAmount = "Enter a planned amount."
  } else if (Number(input.plannedAmount.trim().replace(/,/g, "")) === 0) {
    fieldErrors.plannedAmount = "Enter a planned amount greater than 0."
  } else {
    const amountMessage = amountError(input.plannedAmount, "planned amount")
    if (amountMessage) fieldErrors.plannedAmount = amountMessage
  }
  if (notes.length > 2000) fieldErrors.notes = "Notes must be 2,000 characters or fewer."
  if (fieldErrors.categoryId || fieldErrors.plannedAmount || fieldErrors.notes) {
    return { error: "Check the highlighted fields.", fieldErrors }
  }

  const planned = parseProjectValue(input.plannedAmount)
  if (planned == null || planned <= 0) return { error: "Enter a planned amount greater than 0." }

  const supabase = await createClient()
  const values = {
    project_id: projectId,
    category_id: categoryId,
    planned_amount: planned,
    notes,
  }

  const { data, error } = lineId
    ? await supabase
        .from("project_budget_lines")
        .update(values)
        .eq("id", lineId)
        .eq("project_id", projectId)
        .select("id")
    : await supabase.from("project_budget_lines").insert(values).select("id")

  if (error) {
    const issue = dbIssue(error)
    if (issue?.field === "categoryId") {
      return { error: issue.message, fieldErrors: { categoryId: issue.message } }
    }
    if (error.code === "23503") return { error: "Choose a category on this project." }
    return { error: friendlyDbError(error, "Could not save this budget line.") }
  }
  if (!data || data.length === 0) return { error: "That budget line could not be found." }

  refreshBudget(projectId)
  return { error: null }
}

export async function deleteProjectBudgetLine(
  projectId: string,
  lineId: string,
): Promise<{ error: string | null }> {
  const denied = await denyUnless("project_budgets", "delete")
  if (denied) return { error: denied }
  if (!isUuid(projectId) || !isUuid(lineId)) {
    return { error: "That budget line could not be found." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_budget_lines")
    .delete()
    .eq("id", lineId)
    .eq("project_id", projectId)
    .select("id")

  if (error) return { error: friendlyDbError(error, "Could not delete this budget line.") }
  if (!data || data.length === 0) return { error: "That budget line could not be found." }

  refreshBudget(projectId)
  return { error: null }
}

function refreshBudget(projectId: string) {
  revalidatePath("/projects")
  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/dashboard")
  revalidatePath("/reports")
  revalidatePath("/reports/project-budget")
}
