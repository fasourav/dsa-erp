import { EmployeesTable } from "@/app/(app)/hr/employees/employees-table"
import { getEmployees } from "@/lib/employees"
import { requireModule } from "@/lib/permissions"
import { firstParam } from "@/lib/search"

export const metadata = { title: "Employees" }

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  await requireModule("employees")
  const params = await searchParams
  const { employees, departments, nextCode, error } = await getEmployees()
  const initialQuery = firstParam(params.q)

  return (
    <EmployeesTable
      key={initialQuery || "all"}
      employees={employees}
      departments={departments}
      nextCode={nextCode}
      error={error}
      initialQuery={initialQuery}
    />
  )
}
