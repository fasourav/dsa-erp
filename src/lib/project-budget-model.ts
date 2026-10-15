export type BudgetStatus = "ok" | "warning" | "over"

export type BudgetCategory = {
  id: string
  name: string
  sortOrder: number
}

export type BudgetLineView = {
  key: string
  lineId: string | null
  categoryId: string | null
  categoryName: string
  planned: number
  committed: number
  actual: number
  remaining: number
  notes: string
  status: BudgetStatus
  sortOrder: number
}

export type ProjectBudgetSnapshot = {
  lines: BudgetLineView[]
  categories: BudgetCategory[]
  totals: {
    planned: number
    committed: number
    actual: number
    remaining: number
  }
  status: BudgetStatus | null
  hidden: boolean
  error: string | null
}

export type OverBudgetProject = {
  id: string
  name: string
  planned: number
  actual: number
  overAmount: number
}

export type ProjectBudgetReportLine = {
  project: string
  category: string
  planned: number
  committed: number
  actual: number
  remaining: number
  status: BudgetStatus
  emphasis: "plain" | "subtotal" | "total"
}

export function budgetStatusLabel(status: BudgetStatus): string {
  if (status === "over") return "Over Budget"
  if (status === "warning") return "Near Budget"
  return "On Budget"
}

export function lineBudgetStatus(planned: number, actual: number): BudgetStatus {
  const plannedCents = cents(planned)
  const actualCents = cents(actual)
  if (actualCents > plannedCents) return "over"
  if (plannedCents > 0 && actualCents * 10 >= plannedCents * 9) return "warning"
  return "ok"
}

export function projectBudgetStatus(
  lines: readonly { planned: number; actual: number }[],
): BudgetStatus | null {
  if (lines.length === 0) return null
  // Project status follows totals only. A line with no plan (for example
  // Uncategorised actual) can still show Over on that row without putting the
  // whole project on the Over Budget list when remaining is still positive.
  return lineBudgetStatus(
    sum(lines.map((line) => line.planned)),
    sum(lines.map((line) => line.actual)),
  )
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0)
}
function cents(value: number) {
  return Math.round(value * 100)
}
