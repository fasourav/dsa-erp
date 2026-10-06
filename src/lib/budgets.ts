import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export type BudgetRow = {
  id: string
  departmentId: string
  department: string
  periodYear: number
  periodMonth: number
  allocatedBudget: number
  notes: string
  actualSpent: number
  variance: number
}

export type DepartmentOption = {
  id: string
  name: string
}

export async function getBudgets(): Promise<{
  budgets: BudgetRow[]
  departments: DepartmentOption[]
  error: string | null
}> {
  const supabase = await createClient()
  const { active, names } = await loadDepartments(supabase)

  try {
    const [budgetRows, expenseRows, lineRows, runRows, employeeRows] =
      await Promise.all([
        fetchAllPages(
          (from, to) =>
            supabase
              .from("budgets")
              .select(
                "id, department_id, period_year, period_month, allocated_budget, notes",
              )
              .order("period_year", { ascending: false })
              .order("period_month", { ascending: false })
              .range(from, to),
          "Budget list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("operational_expenses")
              .select("department_id, expense_date, amount")
              .not("department_id", "is", null)
              .order("id", { ascending: true })
              .range(from, to),
          "Operational expense list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("payroll_lines")
              .select("employee_id, payroll_run_id, net_salary")
              .order("id", { ascending: true })
              .range(from, to),
          "Payroll list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("payroll_runs")
              .select("id, period_year, period_month")
              .order("id", { ascending: true })
              .range(from, to),
          "Payroll list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("employees")
              .select("id, department_id")
              .order("id", { ascending: true })
              .range(from, to),
          "Employee list is larger than expected.",
        ),
      ])

    const spent = new Map<string, number>()

    function addSpend(
      departmentId: string | null,
      year: number,
      month: number,
      amount: number,
    ) {
      if (!departmentId || !year || !month) return
      const key = `${departmentId}|${year}|${month}`
      spent.set(key, (spent.get(key) ?? 0) + amount)
    }

    for (const row of expenseRows) {
      const match = /^(\d{4})-(\d{2})-/.exec(row.expense_date ?? "")
      if (!match) continue
      addSpend(
        row.department_id,
        Number(match[1]),
        Number(match[2]),
        toNumber(row.amount),
      )
    }

    const runById = new Map(runRows.map((row) => [row.id, row]))
    const departmentByEmployee = new Map(
      employeeRows.map((row) => [row.id, row.department_id ?? ""]),
    )

    for (const line of lineRows) {
      const run = runById.get(line.payroll_run_id)
      const departmentId = departmentByEmployee.get(line.employee_id) ?? ""
      if (!run || !departmentId) continue
      addSpend(
        departmentId,
        run.period_year,
        run.period_month,
        toNumber(line.net_salary),
      )
    }

    const budgets: BudgetRow[] = budgetRows.map((row) => {
      const allocated = toNumber(row.allocated_budget)
      const actual = roundMoney(
        spent.get(
          `${row.department_id}|${row.period_year}|${row.period_month}`,
        ) ?? 0,
      )

      return {
        id: row.id,
        departmentId: row.department_id,
        department: names.get(row.department_id) ?? "",
        periodYear: row.period_year,
        periodMonth: row.period_month,
        allocatedBudget: allocated,
        notes: row.notes?.trim() ?? "",
        actualSpent: actual,
        variance: roundMoney(allocated - actual),
      }
    })

    return { budgets, departments: active, error: null }
  } catch {
    return { budgets: [], departments: active, error: "Could not load budgets." }
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

async function loadDepartments(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ active: DepartmentOption[]; names: Map<string, string> }> {
  try {
    const rows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("departments")
          .select("id, name, is_active")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true })
          .range(from, to),
      "Department list is larger than expected.",
    )

    const active: DepartmentOption[] = []
    const names = new Map<string, string>()

    for (const row of rows) {
      const name = row.name?.trim() ?? ""
      if (!name) continue
      names.set(row.id, name)
      if (row.is_active) {
        active.push({ id: row.id, name })
      }
    }

    return { active, names }
  } catch {
    return { active: [], names: new Map() }
  }
}
