import type { PaymentStatus } from "@/lib/payment-status"
import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

export type ReceivableRow = {
  id: string
  clientName: string
  projectId: string
  projectName: string
  dueDate: string
  billedAmount: number
  paid: number
  due: number
  status: PaymentStatus | null
}

export type ReceivableColumnId =
  | "projectName"
  | "clientName"
  | "billedAmount"
  | "paid"
  | "due"
  | "dueDate"
  | "status"

export type ReceivableOptionalColumnId = Exclude<
  ReceivableColumnId,
  "projectName" | "clientName"
>

export type ReceivableColumnVisibility = Record<
  ReceivableOptionalColumnId,
  boolean
>

export const receivableColumns: readonly ListColumn<ReceivableColumnId>[] = [
  { id: "projectName", label: "Project", align: "left", locked: true },
  { id: "clientName", label: "Client", align: "left", locked: true },
  { id: "billedAmount", label: "Billed Amount", align: "right", locked: false },
  { id: "paid", label: "Total Paid", align: "right", locked: false },
  { id: "due", label: "Pending Due", align: "right", locked: false },
  { id: "dueDate", label: "Due Date", align: "left", locked: false },
  { id: "status", label: "Status", align: "left", locked: false },
]

const defaultVisibility: ReceivableColumnVisibility = {
  billedAmount: true,
  paid: true,
  due: true,
  dueDate: true,
  status: true,
}

export function defaultReceivableColumns(): ReceivableColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizeReceivableColumns(
  value: unknown,
): ReceivableColumnVisibility {
  return sanitizeColumnVisibility(
    ["billedAmount", "paid", "due", "dueDate", "status"],
    defaultReceivableColumns(),
    value,
  )
}

export function sortReceivables(
  rows: readonly ReceivableRow[],
  sort: SortState<ReceivableColumnId>,
): ReceivableRow[] {
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
  left: ReceivableRow,
  right: ReceivableRow,
  key: ReceivableColumnId,
): number {
  switch (key) {
    case "clientName":
    case "projectName":
    case "dueDate":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "status":
      return (left.status ?? "").localeCompare(right.status ?? "")
    case "billedAmount":
    case "paid":
    case "due":
      return left[key] - right[key]
  }
}
