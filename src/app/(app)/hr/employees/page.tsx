import { EmployeesTable } from "@/app/(app)/hr/employees/employees-table"
import { getEmployees } from "@/lib/employees"

export const metadata = { title: "Employees" }

export default async function EmployeesPage() {
  const { employees, departments, error } = await getEmployees()

  return (
    <EmployeesTable
      employees={employees}
      departments={departments}
      error={error}
    />
  )
}
