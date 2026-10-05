import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import type {
  NamedOption,
  OperationalExpenseRow,
} from "@/lib/operational-expenses"
import { dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import { mergeCategorySuggestions } from "@/lib/vendor-summary"

export async function getOperationalExpenses(): Promise<{
  expenses: OperationalExpenseRow[]
  categories: string[]
  paymentMethods: string[]
  projects: NamedOption[]
  departments: NamedOption[]
  error: string | null
}> {
  const empty = {
    expenses: [] as OperationalExpenseRow[],
    categories: [] as string[],
    paymentMethods: [] as string[],
    projects: [] as NamedOption[],
    departments: [] as NamedOption[],
    error: "Could not load operational expenses.",
  }
  const supabase = await createClient()

  try {
    const [expenseRows, categoryRows, methodRows, projectRows, departmentRows] =
      await Promise.all([
        fetchAllPages(
          (from, to) =>
            supabase
              .from("operational_expenses")
              .select(
                "id, expense_date, category, amount, payment_method, project_id, department_id, notes",
              )
              .order("id", { ascending: true })
              .range(from, to),
          "Operational expense list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("office_expense_categories")
              .select("name, sort_order")
              .order("sort_order", { ascending: true })
              .order("name", { ascending: true })
              .range(from, to),
          "Office expense category list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("payment_methods")
              .select("name, sort_order")
              .order("sort_order", { ascending: true })
              .order("name", { ascending: true })
              .range(from, to),
          "Payment method list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("projects")
              .select("id, name")
              .order("id", { ascending: true })
              .range(from, to),
          "Project list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("departments")
              .select("id, name, is_active")
              .eq("is_active", true)
              .order("sort_order", { ascending: true })
              .order("name", { ascending: true })
              .range(from, to),
          "Department list is larger than expected.",
        ),
      ])

    const projects = projectRows
      .map((row) => ({ id: row.id, name: row.name?.trim() ?? "" }))
      .sort((left, right) =>
        left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
      )
    const departments = departmentRows.map((row) => ({
      id: row.id,
      name: row.name?.trim() ?? "",
    }))
    const projectsById = new Map(projects.map((project) => [project.id, project.name]))
    const departmentsById = new Map(
      departments.map((department) => [department.id, department.name]),
    )

    const expenses = expenseRows.map((row) => ({
      id: row.id,
      expenseDate: dateInputValue(row.expense_date),
      category: row.category?.trim() ?? "",
      amount: toNumber(row.amount),
      paymentMethod: row.payment_method?.trim() ?? "",
      projectId: row.project_id ?? "",
      projectName: row.project_id ? projectsById.get(row.project_id) ?? "" : "",
      departmentId: row.department_id ?? "",
      departmentName: row.department_id
        ? departmentsById.get(row.department_id) ?? ""
        : "",
      notes: row.notes ?? "",
    }))

    return {
      expenses,
      categories: mergeCategorySuggestions(
        categoryRows.map((row) => row.name),
        expenses.map((expense) => expense.category),
      ),
      paymentMethods: mergeCategorySuggestions(
        methodRows.map((row) => row.name),
        expenses.map((expense) => expense.paymentMethod),
      ),
      projects,
      departments,
      error: null,
    }
  } catch {
    return empty
  }
}
