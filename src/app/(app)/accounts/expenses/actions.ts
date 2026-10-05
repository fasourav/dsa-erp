"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import { isIsoDate, parseProjectValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export type ExpenseInput = {
  expenseDate: string
  category: string
  amount: string
  paymentMethod: string
  projectId: string
  departmentId: string
  notes: string
}

export type ExpenseFieldErrors = {
  expenseDate?: string
  category?: string
  amount?: string
  projectId?: string
  departmentId?: string
}

export type ExpenseResult = {
  error: string | null
  fieldErrors?: ExpenseFieldErrors
}

export type DeleteResult = {
  error: string | null
}

export async function addOperationalExpense(
  input: ExpenseInput,
): Promise<ExpenseResult> {
  return saveExpense(null, input)
}

export async function updateOperationalExpense(
  id: string,
  input: ExpenseInput,
): Promise<ExpenseResult> {
  if (!isUuid(id)) {
    return { error: "That expense could not be found." }
  }

  return saveExpense(id, input)
}

export async function deleteOperationalExpense(
  id: string,
): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { error: "That expense could not be found." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("operational_expenses")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return { error: "This expense is used elsewhere and cannot be deleted." }
    }

    return { error: "Could not delete this expense." }
  }

  if (!data || data.length === 0) {
    return { error: "That expense could not be found." }
  }

  revalidatePath("/accounts/expenses")
  revalidatePath("/accounts/bank")
  return { error: null }
}

async function saveExpense(
  id: string | null,
  input: ExpenseInput,
): Promise<ExpenseResult> {
  const expenseDate = input.expenseDate.trim()
  const category = input.category.trim()
  const paymentMethod = input.paymentMethod.trim()
  const projectId = input.projectId.trim()
  const departmentId = input.departmentId.trim()
  const notes = input.notes.trim()
  const amount = parseProjectValue(input.amount)
  const fieldErrors: ExpenseFieldErrors = {}

  if (!isIsoDate(expenseDate)) {
    fieldErrors.expenseDate = "Enter a date."
  }

  if (!category) {
    fieldErrors.category = "Enter a category."
  }

  if (amount === null) {
    fieldErrors.amount = input.amount.trim()
      ? "Enter an amount of 0 or more."
      : "Enter an amount."
  }

  if (projectId && !isUuid(projectId)) {
    fieldErrors.projectId = "Choose a project."
  }

  if (departmentId && !isUuid(departmentId)) {
    fieldErrors.departmentId = "Choose a department."
  }

  if (Object.keys(fieldErrors).length > 0 || amount === null) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  if (projectId) {
    const project = await supabase
      .from("projects")
      .select("id")
      .eq("id", projectId)
      .limit(1)
    if (project.error) {
      return { error: "Could not save this expense." }
    }
    if (!project.data || project.data.length === 0) {
      return { error: null, fieldErrors: { projectId: "Choose a project." } }
    }
  }

  if (departmentId) {
    const department = await supabase
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .limit(1)
    if (department.error) {
      return { error: "Could not save this expense." }
    }
    if (!department.data || department.data.length === 0) {
      return {
        error: null,
        fieldErrors: { departmentId: "Choose a department." },
      }
    }
  }

  const values = {
    expense_date: expenseDate,
    category,
    amount,
    payment_method: paymentMethod || null,
    project_id: projectId || null,
    department_id: departmentId || null,
    notes: notes || null,
  }

  const { data, error } = id
    ? await supabase
        .from("operational_expenses")
        .update(values)
        .eq("id", id)
        .select("id")
    : await supabase.from("operational_expenses").insert(values).select("id")

  if (error) {
    if (error.code === "23503") {
      return { error: "Choose a valid project or department." }
    }

    if (error.code === "23514") {
      return {
        error: null,
        fieldErrors: { amount: "Enter an amount of 0 or more." },
      }
    }

    return { error: "Could not save this expense." }
  }

  if (!data || data.length === 0) {
    return { error: "That expense could not be found." }
  }

  revalidatePath("/accounts/expenses")
  return { error: null }
}
