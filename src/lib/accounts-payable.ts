import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import {
  compareIsoDateNullLast,
  type RowSettlement,
} from "@/lib/settlement-filter"

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
  /** Earliest open bill date, or null when settled, unknown, or figures are hidden. */
  oldestUnpaidBillOn: string | null
  /** Null when financial figures are hidden. Do not infer this from the zeroed amounts. */
  settlement: RowSettlement | null
}

export type PayableColumnId =
  | "projectName"
  | "vendorName"
  | "oldestUnpaidBillOn"
  | "totalPayable"
  | "totalPaid"
  | "pendingPayable"

export type PayableOptionalColumnId = Exclude<
  PayableColumnId,
  "projectName" | "vendorName"
>

export type PayableColumnVisibility = Record<PayableOptionalColumnId, boolean>

export const unpaidSinceExplanation =
  "Date of the earliest bill with an amount still unpaid for this purchase order."

export const payableColumns: readonly ListColumn<PayableColumnId>[] = [
  { id: "projectName", label: "Project", align: "left", locked: true },
  { id: "vendorName", label: "Vendor", align: "left", locked: true },
  {
    id: "oldestUnpaidBillOn",
    label: "Unpaid Since",
    hint: unpaidSinceExplanation,
    align: "left",
    locked: false,
    minWidth: 168,
  },
  { id: "totalPayable", label: "Billed", align: "right", locked: false },
  { id: "totalPaid", label: "Paid", align: "right", locked: false },
  { id: "pendingPayable", label: "Open Payable", align: "right", locked: false },
]

const defaultVisibility: PayableColumnVisibility = {
  oldestUnpaidBillOn: true,
  totalPayable: true,
  totalPaid: true,
  pendingPayable: true,
}

export function defaultPayableColumns(): PayableColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizePayableColumns(value: unknown): PayableColumnVisibility {
  return sanitizeColumnVisibility(
    ["oldestUnpaidBillOn", "totalPayable", "totalPaid", "pendingPayable"],
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
    const primary =
      sort.key === "oldestUnpaidBillOn"
        ? compareIsoDateNullLast(
            left.oldestUnpaidBillOn,
            right.oldestUnpaidBillOn,
            sort.direction,
          )
        : compareRows(left, right, sort.key) * direction
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
    case "oldestUnpaidBillOn":
      return 0
  }
}
