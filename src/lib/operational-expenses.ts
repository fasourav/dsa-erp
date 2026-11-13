import { compareText } from "@/lib/format"
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
  projectId: string
  projectName: string
  departmentId: string
  departmentName: string
  vendorId: string
  vendorName: string
  notes: string
  bankAccountId: string
  bankAccountName: string
  voucherNo: string
  createdByName: string
  createdAt: string
  fromPurchaseOrder: boolean
  purchaseOrderId: string
}

export type ExpenseColumnId =
  | "expenseDate"
  | "category"
  | "amount"
  | "paymentMethod"
  | "project"
  | "department"
  | "bankingChannel"
  | "voucherNo"
  | "notes"
  | "recordedBy"

export type ExpenseOptionalColumnId = Exclude<
  ExpenseColumnId,
  "expenseDate" | "category"
>

export type ExpenseColumnVisibility = Record<ExpenseOptionalColumnId, boolean>

export const sortableExpenseColumns = [
  "expenseDate",
  "category",
  "amount",
  "paymentMethod",
] as const

export const defaultExpenseSort: SortState<ExpenseColumnId> = {
  key: "expenseDate",
  direction: "desc",
}

export const expenseColumns: readonly ListColumn<ExpenseColumnId>[] = [
  { id: "expenseDate", label: "Date", align: "left", locked: true },
  { id: "category", label: "Category", align: "left", locked: true, minWidth: 260 },
  { id: "amount", label: "Amount", align: "right", locked: false },
  { id: "paymentMethod", label: "Payment Method", align: "left", locked: false },
  { id: "project", label: "Project / Office", align: "left", locked: false, sortable: false },
  { id: "department", label: "Department", align: "left", locked: false, sortable: false },
  { id: "bankingChannel", label: "Banking Channel", align: "left", locked: false, sortable: false },
  { id: "voucherNo", label: "Voucher No", align: "left", locked: false, sortable: false },
  { id: "notes", label: "Notes", align: "left", locked: false, sortable: false },
  { id: "recordedBy", label: "Recorded By", align: "left", locked: false, sortable: false },
]

const defaultVisibility: ExpenseColumnVisibility = {
  amount: true,
  paymentMethod: true,
  project: true,
  department: true,
  bankingChannel: true,
  voucherNo: true,
  notes: true,
  recordedBy: true,
}

export function defaultExpenseColumns(): ExpenseColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizeExpenseColumns(value: unknown): ExpenseColumnVisibility {
  return sanitizeColumnVisibility(
    [
      "amount",
      "paymentMethod",
      "project",
      "department",
      "bankingChannel",
      "voucherNo",
      "notes",
      "recordedBy",
    ],
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
      return left.expenseDate.localeCompare(right.expenseDate)
    case "category":
    case "paymentMethod":
    case "notes":
      return compareText(left[key], right[key])
    case "project":
      return compareText(left.projectName, right.projectName)
    case "department":
      return compareText(left.departmentName, right.departmentName)
    case "bankingChannel":
      return compareText(left.bankAccountName, right.bankAccountName)
    case "voucherNo":
      return compareText(left.voucherNo, right.voucherNo)
    case "recordedBy":
      return compareText(left.createdByName, right.createdByName)
    case "amount":
      return left.amount - right.amount
  }
}
