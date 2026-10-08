import type { PaymentStatus } from "@/lib/payment-status"
import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

export type VendorPaymentRow = {
  id: string
  paidOn: string
  amount: number
  method: string
  reference: string
  notes: string
  expenseCategory: string
  bankAccountId: string
  bankAccountName: string
}

export type VendorInvoiceRow = {
  id: string
  issuedOn: string
  amount: number
  status: PaymentStatus
  description: string
  paid: number
  balance: number
  payments: VendorPaymentRow[]
}

export type PurchaseOrderDetail = {
  id: string
  issuedOn: string
  projectId: string
  projectName: string
  vendorId: string
  vendorName: string
  workType: string
  totalValue: number
  totalPaid: number
  totalPending: number
  notes: string
}

export type VendorInvoiceColumnId =
  | "issuedOn"
  | "amount"
  | "paid"
  | "balance"
  | "status"
  | "description"

export type VendorInvoiceOptionalColumnId = Exclude<
  VendorInvoiceColumnId,
  "issuedOn"
>

export type VendorInvoiceColumnVisibility = Record<
  VendorInvoiceOptionalColumnId,
  boolean
>

export const vendorInvoiceColumns: readonly ListColumn<VendorInvoiceColumnId>[] =
  [
    { id: "issuedOn", label: "Issue Date", align: "left", locked: true },
    { id: "description", label: "Description", align: "left", locked: false },
    { id: "amount", label: "Amount", align: "right", locked: false },
    { id: "paid", label: "Paid", align: "right", locked: false },
    { id: "balance", label: "Balance", align: "right", locked: false },
    { id: "status", label: "Status", align: "left", locked: false },
  ]

const defaultVisibility: VendorInvoiceColumnVisibility = {
  description: true,
  amount: true,
  paid: true,
  balance: true,
  status: true,
}

export function defaultVendorInvoiceColumns(): VendorInvoiceColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizeVendorInvoiceColumns(
  value: unknown,
): VendorInvoiceColumnVisibility {
  return sanitizeColumnVisibility(
    ["description", "amount", "paid", "balance", "status"],
    defaultVendorInvoiceColumns(),
    value,
  )
}

export function sortVendorInvoices(
  invoices: readonly VendorInvoiceRow[],
  sort: SortState<VendorInvoiceColumnId>,
): VendorInvoiceRow[] {
  const direction = sort.direction === "asc" ? 1 : -1

  return [...invoices].sort((left, right) => {
    const primary = compareInvoices(left, right, sort.key) * direction
    if (primary !== 0) {
      return primary
    }

    const byDate = right.issuedOn.localeCompare(left.issuedOn)
    if (byDate !== 0) {
      return byDate
    }

    return left.id.localeCompare(right.id)
  })
}

function compareInvoices(
  left: VendorInvoiceRow,
  right: VendorInvoiceRow,
  key: VendorInvoiceColumnId,
): number {
  switch (key) {
    case "issuedOn":
    case "description":
    case "status":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "amount":
    case "paid":
    case "balance":
      return left[key] - right[key]
  }
}
