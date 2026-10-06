import { fetchAllPages } from "@/lib/fetch-pages"
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

  try {
    const [bvaRows, deptRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("budget_vs_actual")
            .select("*")
            .order("period_year", { ascending: false })
            .order("period_month", { ascending: false })
            .range(from, to),
        "Budget list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("departments")
            .select("id, name")
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .range(from, to),
        "Department list is larger than expected.",
      ),
    ])

    const budgets: BudgetRow[] = bvaRows.map((r) => ({
      id: r.budget_id ?? "",
      departmentId: r.department_id ?? "",
      department: r.department ?? "",
      periodYear: r.period_year ?? 0,
      periodMonth: r.period_month ?? 0,
      allocatedBudget: r.allocated_budget ?? 0,
      notes: "",
      actualSpent: r.actual_spent ?? 0,
      variance: r.variance ?? 0,
    }))

    const budgetRaw = await fetchAllPages(
      (from, to) =>
        supabase
          .from("budgets")
          .select("id, notes")
          .order("id", { ascending: true })
          .range(from, to),
      "Budget list is larger than expected.",
    )

    const notesMap = new Map(budgetRaw.map((b) => [b.id, b.notes ?? ""]))
    for (const budget of budgets) {
      budget.notes = notesMap.get(budget.id) ?? ""
    }

    const departments: DepartmentOption[] = deptRows.map((d) => ({
      id: d.id,
      name: d.name,
    }))

    return { budgets, departments, error: null }
  } catch {
    return { budgets: [], departments: [], error: "Could not load budgets." }
  }
}
