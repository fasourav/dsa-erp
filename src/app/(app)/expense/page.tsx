import { ExpenseTable } from "@/app/(app)/expense/expense-table"
import { getPoExpenses } from "@/lib/po-expense-data"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Expense" }

export default async function ExpensePage() {
  await requireModule("expense")
  const page = await getPoExpenses()

  return <ExpenseTable rows={page.rows} error={page.error} />
}
