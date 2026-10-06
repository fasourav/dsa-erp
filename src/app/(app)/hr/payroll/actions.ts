"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import { isIsoDate, parseProjectValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export type PayrollRunInput = {
  periodYear: string
  periodMonth: string
  paidOn: string
  status: string
  notes: string
}

export type PayrollRunFieldErrors = {
  periodYear?: string
  periodMonth?: string
  paidOn?: string
  status?: string
}

export type PayrollRunResult = {
  error: string | null
  fieldErrors?: PayrollRunFieldErrors
  id?: string
}

export type PayrollLineInput = {
  employeeId: string
  basicSalary: string
  allowance: string
  bonus: string
  deductions: string
  notes: string
}

export type PayrollLineFieldErrors = {
  employeeId?: string
  basicSalary?: string
}

export type PayrollLineResult = {
  error: string | null
  fieldErrors?: PayrollLineFieldErrors
}

export type DeleteResult = {
  error: string | null
}

const validStatuses = ["draft", "approved", "paid"]

export async function addPayrollRun(
  input: PayrollRunInput,
): Promise<PayrollRunResult> {
  return savePayrollRun(null, input)
}

export async function updatePayrollRun(
  id: string,
  input: PayrollRunInput,
): Promise<PayrollRunResult> {
  if (!isUuid(id)) return { error: "That payroll run could not be found." }
  return savePayrollRun(id, input)
}

export async function deletePayrollRun(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) return { error: "That payroll run could not be found." }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const { error: lineErr } = await supabase
    .from("payroll_lines")
    .delete()
    .eq("payroll_run_id", id)

  if (lineErr) return { error: "Could not delete payroll lines." }

  const { data, error } = await supabase
    .from("payroll_runs")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) return { error: "Could not delete this payroll run." }
  if (!data || data.length === 0)
    return { error: "That payroll run could not be found." }

  revalidatePath("/hr/payroll")
  return { error: null }
}

async function savePayrollRun(
  id: string | null,
  input: PayrollRunInput,
): Promise<PayrollRunResult> {
  const year = parseInt(input.periodYear, 10)
  const month = parseInt(input.periodMonth, 10)
  const paidOn = input.paidOn.trim()
  const status = input.status.trim()
  const notes = input.notes.trim()
  const fieldErrors: PayrollRunFieldErrors = {}

  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    fieldErrors.periodYear = "Enter a valid year."
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    fieldErrors.periodMonth = "Enter a valid month."
  }
  if (paidOn && !isIsoDate(paidOn)) {
    fieldErrors.paidOn = "Enter a valid date."
  }
  if (!validStatuses.includes(status)) {
    fieldErrors.status = "Choose a status."
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const values = {
    period_year: year,
    period_month: month,
    paid_on: paidOn || null,
    status,
    notes: notes || null,
  }

  const { data, error } = id
    ? await supabase
        .from("payroll_runs")
        .update(values)
        .eq("id", id)
        .select("id")
    : await supabase.from("payroll_runs").insert(values).select("id")

  if (error) return { error: "Could not save this payroll run." }
  if (!data || data.length === 0)
    return { error: "That payroll run could not be found." }

  revalidatePath("/hr/payroll")
  return { error: null, id: data[0].id }
}

export async function addPayrollLine(
  runId: string,
  input: PayrollLineInput,
): Promise<PayrollLineResult> {
  return savePayrollLine(runId, null, input)
}

export async function updatePayrollLine(
  runId: string,
  lineId: string,
  input: PayrollLineInput,
): Promise<PayrollLineResult> {
  if (!isUuid(lineId)) return { error: "That payroll line could not be found." }
  return savePayrollLine(runId, lineId, input)
}

export async function deletePayrollLine(
  lineId: string,
): Promise<DeleteResult> {
  if (!isUuid(lineId)) return { error: "That payroll line could not be found." }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const { data, error } = await supabase
    .from("payroll_lines")
    .delete()
    .eq("id", lineId)
    .select("id")

  if (error) return { error: "Could not delete this payroll line." }
  if (!data || data.length === 0)
    return { error: "That payroll line could not be found." }

  revalidatePath("/hr/payroll")
  return { error: null }
}

async function savePayrollLine(
  runId: string,
  lineId: string | null,
  input: PayrollLineInput,
): Promise<PayrollLineResult> {
  if (!isUuid(runId)) return { error: "That payroll run could not be found." }

  const employeeId = input.employeeId.trim()
  const basicSalary = parseProjectValue(input.basicSalary)
  const allowance = parseProjectValue(input.allowance) ?? 0
  const bonus = parseProjectValue(input.bonus) ?? 0
  const deductions = parseProjectValue(input.deductions) ?? 0
  const notes = input.notes.trim()
  const fieldErrors: PayrollLineFieldErrors = {}

  if (!isUuid(employeeId)) {
    fieldErrors.employeeId = "Choose an employee."
  }
  if (basicSalary === null) {
    fieldErrors.basicSalary = input.basicSalary.trim()
      ? "Enter a valid salary amount."
      : "Enter a basic salary."
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const netSalary = (basicSalary ?? 0) + allowance + bonus - deductions

  const values = {
    payroll_run_id: runId,
    employee_id: employeeId,
    basic_salary: basicSalary ?? 0,
    allowance,
    bonus,
    deductions,
    net_salary: netSalary,
    notes: notes || null,
  }

  const { data, error } = lineId
    ? await supabase
        .from("payroll_lines")
        .update(values)
        .eq("id", lineId)
        .select("id")
    : await supabase.from("payroll_lines").insert(values).select("id")

  if (error) {
    if (error.code === "23503") return { error: "Choose a valid employee." }
    return { error: "Could not save this payroll line." }
  }
  if (!data || data.length === 0)
    return { error: "That payroll line could not be found." }

  revalidatePath("/hr/payroll")
  return { error: null }
}
