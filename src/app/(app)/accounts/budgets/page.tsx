import { BudgetsTable } from "@/app/(app)/accounts/budgets/budgets-table"
import { getBudgets } from "@/lib/budgets"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Budgets" }

export default async function BudgetsPage() {
  await requireModule("budgets")
  const { budgets, departments, error } = await getBudgets()

  return (
    <BudgetsTable budgets={budgets} departments={departments} error={error} />
  )
}
