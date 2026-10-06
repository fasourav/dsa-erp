import { fetchAllPages } from "@/lib/fetch-pages"
import { createClient } from "@/lib/supabase/server"

export type PayrollRunRow = {
  id: string
  periodYear: number
  periodMonth: number
  paidOn: string
  status: string
  notes: string
  lineCount: number
  totalNet: number
}

export type PayrollLineRow = {
  id: string
  payrollRunId: string
  employeeId: string
  employeeName: string
  basicSalary: number
  allowance: number
  bonus: number
  deductions: number
  netSalary: number
  notes: string
}

export type EmployeeOption = {
  id: string
  name: string
}

export async function getPayrollRuns(): Promise<{
  runs: PayrollRunRow[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const [runRows, lineRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("payroll_runs")
            .select("id, period_year, period_month, paid_on, status, notes")
            .order("period_year", { ascending: false })
            .order("period_month", { ascending: false })
            .range(from, to),
        "Payroll list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("payroll_lines")
            .select("payroll_run_id, net_salary")
            .order("id", { ascending: true })
            .range(from, to),
        "Payroll lines are larger than expected.",
      ),
    ])

    const linesByRun = new Map<string, { count: number; total: number }>()
    for (const line of lineRows) {
      const existing = linesByRun.get(line.payroll_run_id) ?? {
        count: 0,
        total: 0,
      }
      existing.count += 1
      existing.total += line.net_salary ?? 0
      linesByRun.set(line.payroll_run_id, existing)
    }

    const runs: PayrollRunRow[] = runRows.map((r) => {
      const agg = linesByRun.get(r.id)
      return {
        id: r.id,
        periodYear: r.period_year,
        periodMonth: r.period_month,
        paidOn: r.paid_on ?? "",
        status: r.status ?? "draft",
        notes: r.notes ?? "",
        lineCount: agg?.count ?? 0,
        totalNet: agg?.total ?? 0,
      }
    })

    return { runs, error: null }
  } catch {
    return { runs: [], error: "Could not load payroll runs." }
  }
}

export async function getPayrollRunDetail(runId: string): Promise<{
  run: PayrollRunRow | null
  lines: PayrollLineRow[]
  employees: EmployeeOption[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const { data: runData, error: runError } = await supabase
      .from("payroll_runs")
      .select("id, period_year, period_month, paid_on, status, notes")
      .eq("id", runId)
      .limit(1)

    if (runError) throw runError
    if (!runData || runData.length === 0) {
      return { run: null, lines: [], employees: [], error: "Payroll run not found." }
    }

    const r = runData[0]

    const [lineRows, empRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("payroll_lines")
            .select(
              "id, payroll_run_id, employee_id, basic_salary, allowance, bonus, deductions, net_salary, notes",
            )
            .eq("payroll_run_id", runId)
            .order("created_at", { ascending: true })
            .range(from, to),
        "Payroll lines are larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("employees")
            .select("id, full_name")
            .eq("is_active", true)
            .order("full_name", { ascending: true })
            .range(from, to),
        "Employee list is larger than expected.",
      ),
    ])

    const empMap = new Map(empRows.map((e) => [e.id, e.full_name]))

    let totalNet = 0
    const lines: PayrollLineRow[] = lineRows.map((l) => {
      const net = l.net_salary ?? 0
      totalNet += net
      return {
        id: l.id,
        payrollRunId: l.payroll_run_id,
        employeeId: l.employee_id,
        employeeName: empMap.get(l.employee_id) ?? "",
        basicSalary: l.basic_salary ?? 0,
        allowance: l.allowance ?? 0,
        bonus: l.bonus ?? 0,
        deductions: l.deductions ?? 0,
        netSalary: net,
        notes: l.notes ?? "",
      }
    })

    const run: PayrollRunRow = {
      id: r.id,
      periodYear: r.period_year,
      periodMonth: r.period_month,
      paidOn: r.paid_on ?? "",
      status: r.status ?? "draft",
      notes: r.notes ?? "",
      lineCount: lines.length,
      totalNet,
    }

    const employees: EmployeeOption[] = empRows.map((e) => ({
      id: e.id,
      name: e.full_name,
    }))

    return { run, lines, employees, error: null }
  } catch {
    return {
      run: null,
      lines: [],
      employees: [],
      error: "Could not load payroll run.",
    }
  }
}
