import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

export type NamedOption = {
  id: string
  name: string
}

export type OperationalExpenseRow = {
  id: string
  expenseDate: string
  category: string
  amount: number
  paymentMethod: string
  departmentId: string
  departmentName: string
  vendorId: string
  vendorName: string
  notes: string
}

export type ExpenseColumnId =
  | "expenseDate"
  | "category"
  | "amount"
  | "paymentMethod"

export type ExpenseOptionalColumnId = Exclude<
  ExpenseColumnId,
  "expenseDate" | "category"
>

export type ExpenseColumnVisibility = Record<ExpenseOptionalColumnId, boolean>

export const expenseColumns: readonly ListColumn<ExpenseColumnId>[] = [
  { id: "expenseDate", label: "Date", align: "left", locked: true },
  { id: "category", label: "Category", align: "left", locked: true },
  { id: "amount", label: "Amount", align: "right", locked: false },
  { id: "paymentMethod", label: "Payment Method", align: "left", locked: false },
]

const defaultVisibility: ExpenseColumnVisibility = {
  amount: true,
  paymentMethod: true,
}

export function defaultExpenseColumns(): ExpenseColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizeExpenseColumns(value: unknown): ExpenseColumnVisibility {
  return sanitizeColumnVisibility(
    ["amount", "paymentMethod"],
    defaultExpenseColumns(),
    value,
  )
}

export function sortExpenses(
  rows: readonly OperationalExpenseRow[],
  sort: SortState<ExpenseColumnId>,
): OperationalExpenseRow[] {
  const direction = sort.direction === "asc" ? 1 : -1

  return [...rows].sort((left, right) => {
    const primary = compareRows(left, right, sort.key) * direction
    if (primary !== 0) {
      return primary
    }

    return right.expenseDate.localeCompare(left.expenseDate) || left.id.localeCompare(right.id)
  })
}

function compareRows(
  left: OperationalExpenseRow,
  right: OperationalExpenseRow,
  key: ExpenseColumnId,
): number {
  switch (key) {
    case "expenseDate":
    case "category":
    case "paymentMethod":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "amount":
      return left.amount - right.amount
  }
}
