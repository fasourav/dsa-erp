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
  issuedOn: string
  dueDate: string
  billedAmount: number
  paid: number
  due: number
  status: PaymentStatus | null
  agingBucket: string
  daysPastDue: number | null
}

export type ReceivableColumnId =
  | "clientName"
  | "projectName"
  | "issuedOn"
  | "dueDate"
  | "billedAmount"
  | "paid"
  | "due"
  | "status"
  | "agingBucket"
  | "daysPastDue"

export type ReceivableOptionalColumnId = Exclude<
  ReceivableColumnId,
  "clientName" | "projectName"
>

export type ReceivableColumnVisibility = Record<
  ReceivableOptionalColumnId,
  boolean
>

export const receivableColumns: readonly ListColumn<ReceivableColumnId>[] = [
  { id: "clientName", label: "Client", align: "left", locked: true },
  { id: "projectName", label: "Project", align: "left", locked: true },
  { id: "issuedOn", label: "Issued", align: "left", locked: false },
  { id: "dueDate", label: "Due", align: "left", locked: false },
  { id: "agingBucket", label: "Aging", align: "left", locked: false },
  { id: "daysPastDue", label: "Days past due", align: "right", locked: false },
  { id: "billedAmount", label: "Billed", align: "right", locked: false },
  { id: "paid", label: "Paid", align: "right", locked: false },
  { id: "due", label: "Due amount", align: "right", locked: false },
  { id: "status", label: "Status", align: "left", locked: false },
]

const defaultVisibility: ReceivableColumnVisibility = {
  issuedOn: true,
  dueDate: true,
  agingBucket: true,
  daysPastDue: true,
  billedAmount: true,
  paid: true,
  due: true,
  status: true,
}

export function defaultReceivableColumns(): ReceivableColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizeReceivableColumns(
  value: unknown,
): ReceivableColumnVisibility {
  return sanitizeColumnVisibility(
    [
      "issuedOn",
      "dueDate",
      "agingBucket",
      "daysPastDue",
      "billedAmount",
      "paid",
      "due",
      "status",
    ],
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
    case "issuedOn":
    case "dueDate":
    case "agingBucket":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "status":
      return (left.status ?? "").localeCompare(right.status ?? "")
    case "daysPastDue":
      return (left.daysPastDue ?? -1) - (right.daysPastDue ?? -1)
    case "billedAmount":
    case "paid":
    case "due":
      return left[key] - right[key]
  }
}
