import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { roundMoney } from "@/lib/payroll-month"
import { createClient } from "@/lib/supabase/server"

export type SalaryEmployee = {
  id: string
  fullName: string
  monthlySalary: number
  allowance: number
  joiningDate: string
  leaveDate: string
  isActive: boolean
}

export type SalaryLine = {
  id: string
  employeeId: string
  employeeName: string
  salary: number
  allowance: number
  bonus: number
  deduction: number
  netPay: number
}

export type MonthlySalary = {
  id: string
  periodYear: number
  periodMonth: number
  paidOn: string
  bankAccountId: string
  paymentMethod: string
  lines: SalaryLine[]
  lineCount: number
  totalPaid: number
}

export async function getPayrollPageData(): Promise<{
  salaries: MonthlySalary[]
  employees: SalaryEmployee[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const [runRows, lineRows, employees] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("payroll_runs")
            .select(
              "id, period_year, period_month, paid_on, bank_account_id, payment_method",
            )
            .order("period_year", { ascending: false })
            .order("period_month", { ascending: false })
            .range(from, to),
        "Payroll list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("payroll_lines")
            .select(
              "id, payroll_run_id, employee_id, basic_salary, allowance, bonus, deductions, net_salary",
            )
            .order("id", { ascending: true })
            .range(from, to),
        "Payroll lines are larger than expected.",
      ),
      listSalaryEmployees(),
    ])

    const names = new Map(employees.map((employee) => [employee.id, employee.fullName]))
    const linesByRun = new Map<string, SalaryLine[]>()

    for (const line of lineRows) {
      const rows = linesByRun.get(line.payroll_run_id) ?? []
      rows.push(toSalaryLine(line, names.get(line.employee_id) ?? ""))
      linesByRun.set(line.payroll_run_id, rows)
    }

    const salaries = runRows.map((run) =>
      toMonthlySalary(run, linesByRun.get(run.id) ?? []),
    )

    return { salaries, employees, error: null }
  } catch {
    return { salaries: [], employees: [], error: "Could not load payroll." }
  }
}

export async function getMonthlySalary(id: string): Promise<{
  salary: MonthlySalary | null
  employees: SalaryEmployee[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("payroll_runs")
      .select(
        "id, period_year, period_month, paid_on, bank_account_id, payment_method",
      )
      .eq("id", id)
      .limit(1)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      return { salary: null, employees: [], error: null }
    }

    const [lineRows, employees] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("payroll_lines")
            .select(
              "id, payroll_run_id, employee_id, basic_salary, allowance, bonus, deductions, net_salary",
            )
            .eq("payroll_run_id", id)
            .order("id", { ascending: true })
            .range(from, to),
        "Payroll lines are larger than expected.",
      ),
      listSalaryEmployees(),
    ])

    const names = new Map(employees.map((employee) => [employee.id, employee.fullName]))
    const lines = lineRows.map((line) =>
      toSalaryLine(line, names.get(line.employee_id) ?? ""),
    )

    return { salary: toMonthlySalary(data[0], lines), employees, error: null }
  } catch {
    return { salary: null, employees: [], error: "Could not load this monthly salary." }
  }
}

export async function listSalaryEmployees(): Promise<SalaryEmployee[]> {
  const supabase = await createClient()
  const rows = await fetchAllPages(
    (from, to) =>
      supabase
        .from("employees_readable")
        .select(
          "id, full_name, monthly_salary, allowance, joining_date, leave_date, is_active",
        )
        .order("full_name", { ascending: true })
        .range(from, to),
    "Employee list is larger than expected.",
  )

  return rows.flatMap((row) => {
    if (!row.id) return []
    return [
      {
        id: row.id,
        fullName: row.full_name?.trim() ?? "",
        monthlySalary: toNumber(row.monthly_salary),
        allowance: toNumber(row.allowance),
        joiningDate: row.joining_date ?? "",
        leaveDate: row.leave_date ?? "",
        isActive: row.is_active ?? true,
      },
    ]
  })
}

function toSalaryLine(
  line: {
    id: string
    employee_id: string
    basic_salary: number
    allowance: number
    bonus: number
    deductions: number
    net_salary: number | null
  },
  employeeName: string,
): SalaryLine {
  return {
    id: line.id,
    employeeId: line.employee_id,
    employeeName,
    salary: toNumber(line.basic_salary),
    allowance: toNumber(line.allowance),
    bonus: toNumber(line.bonus),
    deduction: toNumber(line.deductions),
    netPay: toNumber(line.net_salary),
  }
}

function toMonthlySalary(
  run: {
    id: string
    period_year: number
    period_month: number
    paid_on: string | null
    bank_account_id: string | null
    payment_method: string | null
  },
  lines: SalaryLine[],
): MonthlySalary {
  const sorted = [...lines].sort((left, right) =>
    left.employeeName.localeCompare(right.employeeName, "en", {
      sensitivity: "base",
    }),
  )
  const totalPaid = roundMoney(sorted.reduce((sum, line) => sum + line.netPay, 0))

  return {
    id: run.id,
    periodYear: run.period_year,
    periodMonth: run.period_month,
    paidOn: run.paid_on ?? "",
    bankAccountId: run.bank_account_id ?? "",
    paymentMethod: run.payment_method ?? "",
    lines: sorted,
    lineCount: sorted.length,
    totalPaid,
  }
}
