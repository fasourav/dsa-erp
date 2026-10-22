import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

export type PoExpenseRow = {
  id: string
  expenseDate: string
  projectName: string
  vendorName: string
  workType: string
  expenseAmount: number
  bankingChannel: string
}

export type PoExpenseColumnId =
  | "expenseDate"
  | "projectName"
  | "vendorName"
  | "expenseAmount"
  | "bankingChannel"

export type PoExpenseOptionalColumnId = Exclude<
  PoExpenseColumnId,
  "expenseDate" | "projectName" | "vendorName"
>

export type PoExpenseColumnVisibility = Record<PoExpenseOptionalColumnId, boolean>

export const poExpenseColumns: readonly ListColumn<PoExpenseColumnId>[] = [
  { id: "expenseDate", label: "Date", align: "left", locked: true },
  { id: "projectName", label: "Project", align: "left", locked: true },
  { id: "vendorName", label: "Vendor", align: "left", locked: true },
  { id: "expenseAmount", label: "Expense", align: "right", locked: true },
  { id: "bankingChannel", label: "Banking Channel", align: "left", locked: true },
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
    case "expenseDate":
    case "projectName":
    case "vendorName":
    case "bankingChannel":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "expenseAmount":
      return left.expenseAmount - right.expenseAmount
  }
}
