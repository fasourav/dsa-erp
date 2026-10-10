import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

export type PayableRow = {
  id: string
  vendorName: string
  workType: string
  projectId: string
  projectName: string
  purchaseOrderId: string
  totalPayable: number
  totalPaid: number
  pendingPayable: number
}

export type PayableColumnId =
  | "projectName"
  | "vendorName"
  | "totalPayable"
  | "totalPaid"
  | "pendingPayable"

export type PayableOptionalColumnId = Exclude<
  PayableColumnId,
  "projectName" | "vendorName"
>

export type PayableColumnVisibility = Record<PayableOptionalColumnId, boolean>

export const payableColumns: readonly ListColumn<PayableColumnId>[] = [
  { id: "projectName", label: "Project", align: "left", locked: true },
  { id: "vendorName", label: "Vendor", align: "left", locked: true },
  { id: "totalPayable", label: "Total Payable", align: "right", locked: false },
  { id: "totalPaid", label: "Total Paid", align: "right", locked: false },
  { id: "pendingPayable", label: "Pending Payable", align: "right", locked: false },
]

const defaultVisibility: PayableColumnVisibility = {
  totalPayable: true,
  totalPaid: true,
  pendingPayable: true,
}

export function defaultPayableColumns(): PayableColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizePayableColumns(value: unknown): PayableColumnVisibility {
  return sanitizeColumnVisibility(
    ["totalPayable", "totalPaid", "pendingPayable"],
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
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "totalPayable":
    case "totalPaid":
    case "pendingPayable":
      return left[key] - right[key]
  }
}
