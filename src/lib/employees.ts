import { fetchAllPages } from "@/lib/fetch-pages"
import { createClient } from "@/lib/supabase/server"

export type EmployeeRow = {
  id: string
  fullName: string
  department: string
  designation: string
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
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const [empRows, deptRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("employee_details")
            .select(
              "id, full_name, department, designation, email, phone, joining_date, leave_date, is_active, notes",
            )
            .order("full_name", { ascending: true })
            .range(from, to),
        "Employee list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("departments")
            .select("id, name, is_active")
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
            .range(from, to),
        "Department list is larger than expected.",
      ),
    ])

    const deptById = new Map(deptRows.map((d) => [d.id, d.name]))

    const employees: EmployeeRow[] = empRows.map((row) => ({
      id: row.id ?? "",
      fullName: row.full_name?.trim() ?? "",
      department: row.department?.trim() ?? "",
      designation: row.designation?.trim() ?? "",
      joiningDate: row.joining_date ?? "",
      leaveDate: row.leave_date ?? "",
      isActive: row.is_active ?? true,
      phone: row.phone?.trim() ?? "",
      email: row.email?.trim() ?? "",
      notes: row.notes?.trim() ?? "",
      departmentId: "",
    }))

    const departments: DepartmentOption[] = deptRows.map((d) => ({
      id: d.id,
      name: d.name,
    }))

    const empRaw = await fetchAllPages(
      (from, to) =>
        supabase
          .from("employees")
          .select("id, department_id")
          .order("id", { ascending: true })
          .range(from, to),
      "Employee list is larger than expected.",
    )

    const deptIdMap = new Map(
      empRaw.map((e) => [e.id, e.department_id ?? ""]),
    )

    for (const emp of employees) {
      emp.departmentId = deptIdMap.get(emp.id) ?? ""
      if (!emp.department && emp.departmentId) {
        emp.department = deptById.get(emp.departmentId) ?? ""
      }
    }

    return { employees, departments, error: null }
  } catch {
    return { employees: [], departments: [], error: "Could not load employees." }
  }
}
