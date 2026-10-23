import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export type EmployeeRow = {
  id: string
  employeeCode: string
  fullName: string
  department: string
  designation: string
  monthlySalary: number
  allowance: number
  joiningDate: string
  leaveDate: string
  isActive: boolean
  phone: string
  email: string
  notes: string
  departmentId: string
}

export type DepartmentOption = {
  id: string
  name: string
}

export async function getEmployees(): Promise<{
  employees: EmployeeRow[]
  departments: DepartmentOption[]
  nextCode: string
  error: string | null
}> {
  const supabase = await createClient()
  const { active, names } = await loadDepartments(supabase)
  const { codes, nextCode } = await loadEmployeeCodes(supabase)

  try {
    const rows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("employees_readable")
          .select(
            "id, full_name, department, department_id, designation, monthly_salary, allowance, email, phone, joining_date, leave_date, is_active, notes",
          )
          .order("full_name", { ascending: true })
          .range(from, to),
      "Employee list is larger than expected.",
    )

    const employees: EmployeeRow[] = rows.flatMap((row) => {
      if (!row.id) return []
      const departmentId = row.department_id ?? ""

      return [{
        id: row.id,
        employeeCode: codes.get(row.id) ?? "",
        fullName: row.full_name?.trim() ?? "",
        department: row.department?.trim() || names.get(departmentId) || "",
        designation: row.designation?.trim() ?? "",
        monthlySalary: toNumber(row.monthly_salary),
        allowance: toNumber(row.allowance),
        joiningDate: row.joining_date ?? "",
        leaveDate: row.leave_date ?? "",
        isActive: row.is_active ?? true,
        phone: row.phone?.trim() ?? "",
        email: row.email?.trim() ?? "",
        notes: row.notes?.trim() ?? "",
        departmentId,
      }]
    })

    return { employees, departments: active, nextCode, error: null }
  } catch {
    return {
      employees: [],
      departments: active,
      nextCode,
      error: "Could not load employees.",
    }
  }
}

async function loadEmployeeCodes(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ codes: Map<string, string>; nextCode: string }> {
  try {
    const rows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("employees")
          .select("id, employee_code")
          .order("id", { ascending: true })
          .range(from, to),
      "Employee list is larger than expected.",
    )
    const codes = new Map<string, string>()
    let max = 0
    for (const row of rows) {
      const code = row.employee_code?.trim() ?? ""
      if (row.id) codes.set(row.id, code)
      if (/^[0-9]+$/.test(code)) max = Math.max(max, Number(code))
    }
    return { codes, nextCode: String(max + 1).padStart(3, "0") }
  } catch {
    return { codes: new Map(), nextCode: "001" }
  }
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
