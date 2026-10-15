"use server"

import { titleCaseName } from "@/lib/format"
import { eqVersion, missedUpdateMessage, staleWriteMessage, withVersion } from "@/lib/record-version"
import { revalidatePath } from "next/cache"

import { friendlyDbError, mentions } from "@/lib/db-errors"
import { isUuid } from "@/lib/ids"
import { roundMoney } from "@/lib/payroll-month"
import { isIsoDate, parseProjectValue , isFutureIsoDate } from "@/lib/project-validation"
import { phoneErrorForStored, toE164FromStored } from "@/lib/phone"
import { employeeLeaveSchema, firstIssue } from "@/lib/schemas"
import { createClient } from "@/lib/supabase/server"
import { cleanUpDeletedAttachmentFiles } from "@/lib/attachment-files"
import { denyUnless, getAccess } from "@/lib/permissions"

export type EmployeeInput = {
  version?: string
  fullName: string
  departmentId: string
  designation: string
  monthlySalary: string
  allowance: string
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
  monthlySalary?: string
  allowance?: string
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
  const denied = await denyUnless("employees", "add")
  if (denied) return { error: denied }
  return saveEmployee(null, input)
}

export async function updateEmployee(
  id: string,
  input: EmployeeInput,
): Promise<EmployeeResult> {
  const denied = await denyUnless("employees", "edit")
  if (denied) return { error: denied }
  if (!isUuid(id)) {
    return { error: "That employee could not be found." }
  }

  return saveEmployee(id, input)
}

export async function deleteEmployee(id: string): Promise<DeleteResult> {
  const denied = await denyUnless("employees", "delete")
  if (denied) return { error: denied }
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
          "This employee is linked to monthly salary records and cannot be deleted.",
      }
    }

    return { error: "Could not delete this employee." }
  }

  if (!data || data.length === 0) {
    return { error: "That employee could not be found." }
  }

  cleanUpDeletedAttachmentFiles()
  revalidatePath("/hr/employees")
  return { error: null }
}

async function saveEmployee(
  id: string | null,
  input: EmployeeInput,
): Promise<EmployeeResult> {
  const fullName = titleCaseName(input.fullName)
  const designation = input.designation.trim()
  const monthlySalary = parseProjectValue(input.monthlySalary)
  const allowance = parseProjectValue(input.allowance.trim() || "0")
  const phone = toE164FromStored(input.phone)
  const email = input.email.trim()
  const notes = input.notes.trim()
  const departmentId = input.departmentId.trim()
  const joiningDate = input.joiningDate.trim()
  const leaveDate = input.leaveDate.trim()
  const fieldErrors: EmployeeFieldErrors = {}
  const access = await getAccess()
  // People without Show Financials see salaries as blank, so an edit must not write them back.
  const keepPay = Boolean(id) && !access?.showFinancials

  if (!fullName) {
    fieldErrors.fullName = "Enter the employee name."
  }

  if (!keepPay && monthlySalary === null) {
    fieldErrors.monthlySalary = input.monthlySalary.trim()
      ? "Enter a valid monthly salary."
      : "Enter a monthly salary."
  }

  if (!keepPay && allowance === null) {
    fieldErrors.allowance = "Enter a valid allowance."
  }

  if (!isIsoDate(joiningDate)) {
    fieldErrors.joiningDate = "Enter a joining date."
  } else if (isFutureIsoDate(joiningDate)) {
    fieldErrors.joiningDate = "Joining date can't be in the future."
  }

  if (leaveDate && !isIsoDate(leaveDate)) {
    fieldErrors.leaveDate = "Enter a valid leave date."
  }

  if (!fieldErrors.joiningDate && !fieldErrors.leaveDate) {
    const leaveCheck = employeeLeaveSchema.safeParse({ joiningDate, leaveDate })
    if (!leaveCheck.success) {
      const joiningIssue = firstIssue(leaveCheck.error, "joiningDate")
      const leaveIssue = firstIssue(leaveCheck.error, "leaveDate")
      if (joiningIssue) fieldErrors.joiningDate = joiningIssue
      if (leaveIssue) fieldErrors.leaveDate = leaveIssue
    }
  }

  if (departmentId && !isUuid(departmentId)) {
    fieldErrors.departmentId = "Choose a department."
  }

  const phoneError = phoneErrorForStored(input.phone)
  if (phoneError) fieldErrors.phone = phoneError

  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const details = {
    full_name: fullName,
    department_id: departmentId || null,
    designation: designation || null,
    joining_date: joiningDate,
    leave_date: leaveDate || null,
    is_active: input.isActive,
    phone: phone || null,
    email: email || null,
    notes: notes || null,
  }
  const values = {
    ...details,
    monthly_salary: roundMoney(monthlySalary ?? 0),
    allowance: roundMoney(allowance ?? 0),
  }

  const { data, error } = id
    ? await eqVersion(
        supabase.from("employees").update(withVersion(keepPay ? details : values, input.version)).eq("id", id),
        input.version,
      ).select("id")
    : await supabase.from("employees").insert(values).select("id")

  if (error) {
    const stale = staleWriteMessage(error)
    if (stale) return { error: stale }

    if (error.code === "23503") {
      return { error: "Choose a valid department." }
    }

    if (mentions(error, "employees_leave_after_join") || mentions(error, "leave date")) {
      return {
        error: null,
        fieldErrors: { leaveDate: "Leave date cannot be before the joining date." },
      }
    }

    return { error: friendlyDbError(error, "Could not save this employee.") }
  }

  if (!data || data.length === 0) {
    return { error: missedUpdateMessage(id ? input.version : undefined, "That employee could not be found.") }
  }

  revalidatePath("/hr/employees")
  revalidatePath("/hr/payroll")
  return { error: null }
}
