"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import { netPay, roundMoney, workedInMonth } from "@/lib/payroll-month"
import { isIsoDate, parseProjectValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import { toNumber } from "@/lib/format"

export type PayLineInput = {
  employeeId: string
  bonus: string
  deduction: string
}

export type PaySalaryInput = {
  periodYear: string
  periodMonth: string
  paidOn: string
  bankAccountId: string
  paymentMethod: string
  lines: PayLineInput[]
}

export type PaySalaryFieldErrors = {
  month?: string
  paidOn?: string
  bankAccountId?: string
  paymentMethod?: string
}

export type PaySalaryResult = {
  error: string | null
  fieldErrors?: PaySalaryFieldErrors
  id?: string
}

export type DeleteResult = {
  error: string | null
}

const alreadyPaid = "Salaries for this month are already paid."

export async function payMonthlySalary(
  input: PaySalaryInput,
): Promise<PaySalaryResult> {
  return saveMonthlySalary(null, input)
}

export async function updateMonthlySalary(
  id: string,
  input: PaySalaryInput,
): Promise<PaySalaryResult> {
  if (!isUuid(id)) {
    return { error: "That monthly salary could not be found." }
  }

  return saveMonthlySalary(id, input)
}

export async function deleteMonthlySalary(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) {
    return { error: "That monthly salary could not be found." }
  }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) {
    return { error: "You must be signed in." }
  }

  const { error: lineErr } = await supabase
    .from("payroll_lines")
    .delete()
    .eq("payroll_run_id", id)

  if (lineErr) {
    return { error: "Could not delete this monthly salary." }
  }

  const { data, error } = await supabase
    .from("payroll_runs")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    return { error: "Could not delete this monthly salary." }
  }

  if (!data || data.length === 0) {
    return { error: "That monthly salary could not be found." }
  }

  revalidatePayroll(id)
  return { error: null }
}

async function saveMonthlySalary(
  id: string | null,
  input: PaySalaryInput,
): Promise<PaySalaryResult> {
  const year = parseInt(input.periodYear, 10)
  const month = parseInt(input.periodMonth, 10)
  const paidOn = input.paidOn.trim()
  const bankAccountId = input.bankAccountId.trim()
  const paymentMethod = input.paymentMethod.trim()
  const fieldErrors: PaySalaryFieldErrors = {}

  if (!Number.isFinite(year) || year < 2000 || year > 2100 || !Number.isFinite(month) || month < 1 || month > 12) {
    fieldErrors.month = "Choose a month."
  }

  if (!isIsoDate(paidOn)) {
    fieldErrors.paidOn = "Enter the payment date."
  }

  if (!isUuid(bankAccountId)) {
    fieldErrors.bankAccountId = "Choose a bank account."
  }

  if (!paymentMethod) {
    fieldErrors.paymentMethod = "Choose a payment method."
  }

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    return { error: "Include at least one employee.", fieldErrors }
  }

  const employeeIds = input.lines.map((line) => line.employeeId.trim())
  if (employeeIds.some((employeeId) => !isUuid(employeeId))) {
    return { error: "Choose an employee who worked this month.", fieldErrors }
  }

  if (new Set(employeeIds).size !== employeeIds.length) {
    return { error: "Each employee can only be paid once.", fieldErrors }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) {
    return { error: "You must be signed in." }
  }

  const [{ data: methodRows, error: methodError }, { data: accountRows, error: accountError }] =
    await Promise.all([
      supabase.from("payment_methods").select("name").limit(500),
      supabase.from("bank_accounts").select("id").eq("id", bankAccountId).limit(1),
    ])

  if (methodError || accountError) {
    return { error: "Could not save this monthly salary." }
  }

  const methodNames = new Set((methodRows ?? []).map((row) => row.name))
  if (!methodNames.has(paymentMethod)) {
    return {
      error: null,
      fieldErrors: { paymentMethod: "Choose a payment method." },
    }
  }

  if (!accountRows || accountRows.length === 0) {
    return {
      error: null,
      fieldErrors: { bankAccountId: "Choose a bank account." },
    }
  }

  const { data: employeeRows, error: employeeError } = await supabase
    .from("employees")
    .select(
      "id, full_name, monthly_salary, allowance, joining_date, leave_date, is_active",
    )
    .in("id", employeeIds)

  if (employeeError) {
    return { error: "Could not save this monthly salary." }
  }

  const employees = new Map((employeeRows ?? []).map((row) => [row.id, row]))
  if (employees.size !== employeeIds.length) {
    return { error: "Choose an employee who worked this month." }
  }

  let existingLineIds = new Map<string, string>()
  if (id) {
    const { data: currentRows, error: currentError } = await supabase
      .from("payroll_runs")
      .select("id, period_year, period_month")
      .eq("id", id)
      .limit(1)

    if (currentError) {
      return { error: "Could not save this monthly salary." }
    }

    const current = currentRows?.[0]
    if (!current) {
      return { error: "That monthly salary could not be found." }
    }

    if (current.period_year !== year || current.period_month !== month) {
      return { error: "This monthly salary is for a different month." }
    }

    const { data: lineRows, error: lineError } = await supabase
      .from("payroll_lines")
      .select("id, employee_id")
      .eq("payroll_run_id", id)

    if (lineError) {
      return { error: "Could not save this monthly salary." }
    }

    existingLineIds = new Map(
      (lineRows ?? []).map((line) => [line.employee_id, line.id]),
    )
  } else {
    const { data: takenRows, error: takenError } = await supabase
      .from("payroll_runs")
      .select("id")
      .eq("period_year", year)
      .eq("period_month", month)
      .limit(1)

    if (takenError) {
      return { error: "Could not save this monthly salary." }
    }

    if (takenRows && takenRows.length > 0) {
      return { error: null, fieldErrors: { month: alreadyPaid } }
    }
  }

  const prepared: {
    employeeId: string
    salary: number
    allowance: number
    bonus: number
    deduction: number
  }[] = []

  for (const line of input.lines) {
    const employeeId = line.employeeId.trim()
    const employee = employees.get(employeeId)
    if (!employee) {
      return { error: "Choose an employee who worked this month." }
    }

    const name = employee.full_name?.trim() || "Employee"
    const alreadyOnSlip = existingLineIds.has(employeeId)
    const eligible = workedInMonth(
      {
        isActive: employee.is_active ?? false,
        joiningDate: employee.joining_date ?? "",
        leaveDate: employee.leave_date ?? "",
      },
      year,
      month,
    )

    if (!eligible && !alreadyOnSlip) {
      return { error: `${name} did not work this month.` }
    }

    const bonus = parseProjectValue(line.bonus.trim() || "0")
    const deduction = parseProjectValue(line.deduction.trim() || "0")
    if (bonus === null) {
      return { error: `Enter a valid bonus for ${name}.` }
    }
    if (deduction === null) {
      return { error: `Enter a valid deduction for ${name}.` }
    }

    const bonusAmount = roundMoney(bonus)
    const deductionAmount = roundMoney(deduction)
    const salary = roundMoney(toNumber(employee.monthly_salary))
    const allowance = roundMoney(toNumber(employee.allowance))
    if (netPay(salary, allowance, bonusAmount, deductionAmount) < 0) {
      return { error: `Deduction is higher than pay for ${name}.` }
    }

    prepared.push({
      employeeId,
      salary,
      allowance,
      bonus: bonusAmount,
      deduction: deductionAmount,
    })
  }

  const runValues = {
    period_year: year,
    period_month: month,
    paid_on: paidOn,
    status: "paid",
    bank_account_id: bankAccountId,
    payment_method: paymentMethod,
    notes: null,
  }

  let salaryId = id
  if (!salaryId) {
    const { data, error } = await supabase
      .from("payroll_runs")
      .insert(runValues)
      .select("id")

    if (error) {
      if (error.code === "23505") {
        return { error: null, fieldErrors: { month: alreadyPaid } }
      }
      return { error: "Could not save this monthly salary." }
    }

    salaryId = data?.[0]?.id ?? null
    if (!salaryId) {
      return { error: "Could not save this monthly salary." }
    }
  } else {
    const { data, error } = await supabase
      .from("payroll_runs")
      .update(runValues)
      .eq("id", salaryId)
      .select("id")

    if (error || !data || data.length === 0) {
      return { error: "Could not save this monthly salary." }
    }
  }

  for (const line of prepared) {
    const lineId = existingLineIds.get(line.employeeId)
    const values = {
      payroll_run_id: salaryId,
      employee_id: line.employeeId,
      basic_salary: line.salary,
      allowance: line.allowance,
      bonus: line.bonus,
      deductions: line.deduction,
    }

    const { error } = lineId
      ? await supabase.from("payroll_lines").update(values).eq("id", lineId)
      : await supabase.from("payroll_lines").insert(values)

    if (error) {
      if (!id) {
        await supabase.from("payroll_runs").delete().eq("id", salaryId)
      }
      return { error: "Could not save this monthly salary." }
    }
  }

  const kept = new Set(prepared.map((line) => line.employeeId))
  const removedIds = [...existingLineIds.entries()]
    .filter(([employeeId]) => !kept.has(employeeId))
    .map(([, lineId]) => lineId)

  if (removedIds.length > 0) {
    const { error } = await supabase.from("payroll_lines").delete().in("id", removedIds)
    if (error) {
      return { error: "Could not save this monthly salary." }
    }
  }

  revalidatePayroll(salaryId)
  return { error: null, id: salaryId }
}

function revalidatePayroll(id: string) {
  revalidatePath("/hr/payroll")
  revalidatePath(`/hr/payroll/${id}`)
  revalidatePath("/accounts/bank")
  revalidatePath("/accounts/budgets")
  revalidatePath("/dashboard")
}
