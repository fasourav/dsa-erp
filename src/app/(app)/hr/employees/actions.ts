"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import { isIsoDate } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export type EmployeeInput = {
  fullName: string
  departmentId: string
  designation: string
  joiningDate: string
  leaveDate: string
  isActive: boolean
  phone: string
  email: string
  notes: string
}

export type EmployeeFieldErrors = {
  fullName?: string
  departmentId?: string
  joiningDate?: string
  leaveDate?: string
  email?: string
  phone?: string
}

export type EmployeeResult = {
  error: string | null
  fieldErrors?: EmployeeFieldErrors
}

export type DeleteResult = {
  error: string | null
}

export async function addEmployee(
  input: EmployeeInput,
): Promise<EmployeeResult> {
  return saveEmployee(null, input)
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput,
): Promise<EmployeeResult> {
  if (!isUuid(id)) {
    return { error: "That employee could not be found." }
  }

  return saveEmployee(id, input)
}

export async function deleteEmployee(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { error: "That employee could not be found." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return {
        error:
          "This employee is linked to payroll records and cannot be deleted.",
      }
    }

    return { error: "Could not delete this employee." }
  }

  if (!data || data.length === 0) {
    return { error: "That employee could not be found." }
  }

  revalidatePath("/hr/employees")
  return { error: null }
}

async function saveEmployee(
  id: string | null,
  input: EmployeeInput,
): Promise<EmployeeResult> {
  const fullName = input.fullName.trim()
  const designation = input.designation.trim()
  const phone = input.phone.trim()
  const email = input.email.trim()
  const notes = input.notes.trim()
  const departmentId = input.departmentId.trim()
  const joiningDate = input.joiningDate.trim()
  const leaveDate = input.leaveDate.trim()
  const fieldErrors: EmployeeFieldErrors = {}

  if (!fullName) {
    fieldErrors.fullName = "Enter the employee name."
  }

  if (!isIsoDate(joiningDate)) {
    fieldErrors.joiningDate = "Enter a joining date."
  }

  if (leaveDate && !isIsoDate(leaveDate)) {
    fieldErrors.leaveDate = "Enter a valid leave date."
  }

  if (departmentId && !isUuid(departmentId)) {
    fieldErrors.departmentId = "Choose a department."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  let departmentName: string | null = null
  if (departmentId) {
    const { data: deptData } = await supabase
      .from("departments")
      .select("name")
      .eq("id", departmentId)
      .limit(1)
    departmentName = deptData?.[0]?.name ?? null
  }

  const values = {
    full_name: fullName,
    department: departmentName,
    department_id: departmentId || null,
    designation: designation || null,
    joining_date: joiningDate,
    leave_date: leaveDate || null,
    is_active: input.isActive,
    phone: phone || null,
    email: email || null,
    notes: notes || null,
  }

  const { data, error } = id
    ? await supabase
        .from("employees")
        .update(values)
        .eq("id", id)
        .select("id")
    : await supabase.from("employees").insert(values).select("id")

  if (error) {
    if (error.code === "23503") {
      return { error: "Choose a valid department." }
    }

    return { error: "Could not save this employee." }
  }

  if (!data || data.length === 0) {
    return { error: "That employee could not be found." }
  }

  revalidatePath("/hr/employees")
  return { error: null }
}
