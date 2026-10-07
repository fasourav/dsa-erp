import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

export type PoExpenseRow = {
  id: string
  projectName: string
  vendorName: string
  expenseAmount: number
  bankingChannel: string
}

export type PoExpenseColumnId =
  | "projectName"
  | "vendorName"
  | "expenseAmount"
  | "bankingChannel"

export type PoExpenseOptionalColumnId = Exclude<
  PoExpenseColumnId,
  "projectName" | "vendorName"
>

export type PoExpenseColumnVisibility = Record<PoExpenseOptionalColumnId, boolean>

export const poExpenseColumns: readonly ListColumn<PoExpenseColumnId>[] = [
  { id: "projectName", label: "Project", align: "left", locked: true },
  { id: "vendorName", label: "Vendor", align: "left", locked: true },
  { id: "expenseAmount", label: "Expense Amount", align: "right", locked: false },
  { id: "bankingChannel", label: "Banking Channel", align: "left", locked: false },
]

const defaultVisibility: PoExpenseColumnVisibility = {
  expenseAmount: true,
  bankingChannel: true,
}

export function defaultPoExpenseColumns(): PoExpenseColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizePoExpenseColumns(
  value: unknown,
): PoExpenseColumnVisibility {
  return sanitizeColumnVisibility(
    ["expenseAmount", "bankingChannel"],
    defaultPoExpenseColumns(),
    value,
  )
}

export function sortPoExpenses(
  rows: readonly PoExpenseRow[],
  sort: SortState<PoExpenseColumnId>,
): PoExpenseRow[] {
  const direction = sort.direction === "asc" ? 1 : -1

  return [...rows].sort((left, right) => {
    const primary = compareRows(left, right, sort.key) * direction
    if (primary !== 0) {
      return primary
    }

    return left.id.localeCompare(right.id)
  })
}

function compareRows(
  left: PoExpenseRow,
  right: PoExpenseRow,
  key: PoExpenseColumnId,
): number {
  switch (key) {
    case "projectName":
    case "vendorName":
    case "bankingChannel":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "expenseAmount":
      return left.expenseAmount - right.expenseAmount
  }
}
