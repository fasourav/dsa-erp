import type { PaymentStatus } from "@/lib/payment-status"
import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

export type PayableRow = {
  id: string
  vendorName: string
  projectId: string
  projectName: string
  purchaseOrderId: string
  issuedOn: string
  dueDate: string
  totalPayable: number
  totalPaid: number
  pendingPayable: number
  status: PaymentStatus | null
  agingBucket: string
  daysPastDue: number | null
}

export type PayableColumnId =
  | "vendorName"
  | "projectName"
  | "issuedOn"
  | "dueDate"
  | "totalPayable"
  | "totalPaid"
  | "pendingPayable"
  | "status"
  | "agingBucket"
  | "daysPastDue"

export type PayableOptionalColumnId = Exclude<
  PayableColumnId,
  "vendorName" | "projectName"
>

export type PayableColumnVisibility = Record<PayableOptionalColumnId, boolean>

export const payableColumns: readonly ListColumn<PayableColumnId>[] = [
  { id: "vendorName", label: "Vendor", align: "left", locked: true },
  { id: "projectName", label: "Project", align: "left", locked: true },
  { id: "issuedOn", label: "Issued", align: "left", locked: false },
  { id: "dueDate", label: "Due", align: "left", locked: false },
  { id: "agingBucket", label: "Aging", align: "left", locked: false },
  { id: "daysPastDue", label: "Days past due", align: "right", locked: false },
  { id: "totalPayable", label: "Payable", align: "right", locked: false },
  { id: "totalPaid", label: "Paid", align: "right", locked: false },
  { id: "pendingPayable", label: "Pending", align: "right", locked: false },
  { id: "status", label: "Status", align: "left", locked: false },
]

const defaultVisibility: PayableColumnVisibility = {
  issuedOn: true,
  dueDate: true,
  agingBucket: true,
  daysPastDue: true,
  totalPayable: true,
  totalPaid: true,
  pendingPayable: true,
  status: true,
}

export function defaultPayableColumns(): PayableColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizePayableColumns(value: unknown): PayableColumnVisibility {
  return sanitizeColumnVisibility(
    [
      "issuedOn",
      "dueDate",
      "agingBucket",
      "daysPastDue",
      "totalPayable",
      "totalPaid",
      "pendingPayable",
      "status",
    ],
    defaultPayableColumns(),
    value,
  )
}

export function sortPayables(
  rows: readonly PayableRow[],
  sort: SortState<PayableColumnId>,
): PayableRow[] {
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
  left: PayableRow,
  right: PayableRow,
  key: PayableColumnId,
): number {
  switch (key) {
    case "vendorName":
    case "projectName":
    case "issuedOn":
    case "dueDate":
    case "agingBucket":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "status":
      return (left.status ?? "").localeCompare(right.status ?? "")
    case "daysPastDue":
      return (left.daysPastDue ?? -1) - (right.daysPastDue ?? -1)
    case "totalPayable":
    case "totalPaid":
    case "pendingPayable":
      return left[key] - right[key]
  }
}
