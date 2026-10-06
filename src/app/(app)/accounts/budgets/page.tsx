import { BudgetsTable } from "@/app/(app)/accounts/budgets/budgets-table"
import { getBudgets } from "@/lib/budgets"

export const metadata = { title: "Budgets" }

export default async function BudgetsPage() {
  const { budgets, departments, error } = await getBudgets()

  return (
    <BudgetsTable budgets={budgets} departments={departments} error={error} />
  )
}
