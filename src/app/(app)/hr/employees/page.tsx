import { EmployeesTable } from "@/app/(app)/hr/employees/employees-table"
import { getEmployees } from "@/lib/employees"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Employees" }

export default async function EmployeesPage() {
  await requireModule("employees")
  const { employees, departments, error } = await getEmployees()

  return (
    <EmployeesTable
      employees={employees}
      departments={departments}
      error={error}
    />
  )
}
