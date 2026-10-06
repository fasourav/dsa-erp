import { ExpensesTable } from "@/app/(app)/accounts/expenses/expenses-table"
import { getOperationalExpenses } from "@/lib/operational-expenses-data"

export const metadata = { title: "Operational Expenses" }

export default async function OperationalExpensesPage() {
  const page = await getOperationalExpenses()

  return (
    <ExpensesTable
      expenses={page.expenses}
      categories={page.categories}
      departments={page.departments}
      vendors={page.vendors}
      paymentMethods={page.paymentMethods}
      bankAccounts={page.bankAccounts}
      error={page.error}
    />
  )
}
