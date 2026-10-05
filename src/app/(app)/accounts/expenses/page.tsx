import { ExpensesTable } from "@/app/(app)/accounts/expenses/expenses-table"
import { getOperationalExpenses } from "@/lib/operational-expenses-data"

export const metadata = { title: "Operational expenses" }

export default async function OperationalExpensesPage() {
  const page = await getOperationalExpenses()

  return (
    <ExpensesTable
      expenses={page.expenses}
      categories={page.categories}
      paymentMethods={page.paymentMethods}
      projects={page.projects}
      departments={page.departments}
      error={page.error}
    />
  )
}
