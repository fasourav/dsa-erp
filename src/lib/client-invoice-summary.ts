import { compareText } from "@/lib/format"
import type { ClientInvoiceStatus } from "@/lib/payment-status"
import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

export type ClientPaymentRow = {
  id: string
  paidOn: string
  amount: number
  method: string
  reference: string
  notes: string
  remarks: string
  bankAccountId: string
  bankAccountName: string
}

export type ClientInvoiceRow = {
  id: string
  projectId: string
  projectName: string
  clientId: string
  clientName: string
  issuedOn: string
  dueOn: string
  amount: number
  status: ClientInvoiceStatus
  description: string
  paid: number
  balance: number
  payments: ClientPaymentRow[]
}

export type InvoiceProjectOption = {
  id: string
  name: string
  clientId: string
  clientName: string
}

export type ClientInvoiceColumnId =
  | "issuedOn"
  | "projectName"
  | "clientName"
  | "amount"
  | "paid"
  | "status"

export type ClientInvoiceOptionalColumnId = Exclude<
  ClientInvoiceColumnId,
  "issuedOn" | "projectName" | "clientName"
>

export type ClientInvoiceColumnVisibility = Record<
  ClientInvoiceOptionalColumnId,
  boolean
>

export const sortableClientInvoiceColumns = [
  "issuedOn",
  "amount",
  "status",
] as const

export const defaultClientInvoiceSort: SortState<ClientInvoiceColumnId> = {
  key: "issuedOn",
  direction: "desc",
}

export const clientInvoiceColumns: readonly ListColumn<ClientInvoiceColumnId>[] =
  [
    { id: "issuedOn", label: "Issue Date", align: "left", locked: true },
    { id: "projectName", label: "Project", align: "left", locked: true, sortable: false },
    { id: "clientName", label: "Client", align: "left", locked: true, sortable: false },
    { id: "amount", label: "Amount", align: "right", locked: false },
    { id: "paid", label: "Paid", align: "right", locked: false, sortable: false },
    { id: "status", label: "Status", align: "left", locked: false },
  ]

const defaultVisibility: ClientInvoiceColumnVisibility = {
  amount: true,
  paid: true,
  status: true,
}

export function defaultClientInvoiceColumns(): ClientInvoiceColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizeClientInvoiceColumns(
  value: unknown,
): ClientInvoiceColumnVisibility {
  return sanitizeColumnVisibility(
    ["amount", "paid", "status"],
    defaultClientInvoiceColumns(),
    value,
  )
}

export function sortClientInvoices(
  invoices: readonly ClientInvoiceRow[],
  sort: SortState<ClientInvoiceColumnId>,
): ClientInvoiceRow[] {
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
  left: ClientInvoiceRow,
  right: ClientInvoiceRow,
  key: ClientInvoiceColumnId,
): number {
  switch (key) {
    case "issuedOn":
      return left.issuedOn.localeCompare(right.issuedOn)
    case "projectName":
    case "clientName":
    case "status":
      return compareText(left[key], right[key])
    case "amount":
    case "paid":
      return left[key] - right[key]
  }
}
