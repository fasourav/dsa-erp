import { Badge } from "@/components/ui/badge"
import { budgetStatusLabel, type BudgetStatus } from "@/lib/project-budget-model"

export function BudgetStatusBadge({ status }: { status: BudgetStatus }) {
  if (status === "ok" || status === "unplanned") return null

  return (
    <Badge variant={status === "over" ? "destructive" : "warning"}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {budgetStatusLabel(status)}
    </Badge>
  )
}
