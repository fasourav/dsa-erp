import type { PaymentStatus } from "@/lib/payment-status"
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
  status: PaymentStatus
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
  | "dueOn"
  | "amount"
  | "paid"
  | "balance"
  | "status"
  | "description"

export type ClientInvoiceOptionalColumnId = Exclude<
  ClientInvoiceColumnId,
  "issuedOn" | "projectName" | "clientName"
>

export type ClientInvoiceColumnVisibility = Record<
  ClientInvoiceOptionalColumnId,
  boolean
>

export const clientInvoiceColumns: readonly ListColumn<ClientInvoiceColumnId>[] =
  [
    { id: "issuedOn", label: "Issued", align: "left", locked: true },
    { id: "projectName", label: "Project", align: "left", locked: true },
    { id: "clientName", label: "Client", align: "left", locked: true },
    { id: "dueOn", label: "Due", align: "left", locked: false },
    { id: "description", label: "Description", align: "left", locked: false },
    { id: "amount", label: "Amount", align: "right", locked: false },
    { id: "paid", label: "Paid", align: "right", locked: false },
    { id: "balance", label: "Balance", align: "right", locked: false },
    { id: "status", label: "Status", align: "left", locked: false },
  ]

const defaultVisibility: ClientInvoiceColumnVisibility = {
  dueOn: true,
  description: false,
  amount: true,
  paid: true,
  balance: true,
  status: true,
}

export function defaultClientInvoiceColumns(): ClientInvoiceColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizeClientInvoiceColumns(
  value: unknown,
): ClientInvoiceColumnVisibility {
  return sanitizeColumnVisibility(
    ["dueOn", "description", "amount", "paid", "balance", "status"],
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
    case "dueOn":
    case "projectName":
    case "clientName":
    case "description":
    case "status":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "amount":
    case "paid":
    case "balance":
      return left[key] - right[key]
  }
}
