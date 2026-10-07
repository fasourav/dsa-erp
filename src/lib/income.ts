import { dateInputValue } from "@/lib/project-validation"
import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

export type IncomeRow = {
  id: string
  projectName: string
  projectType: string
  invoiceAmount: number
  bankingChannel: string
  paidOn: string
}

export type IncomeColumnId =
  | "projectName"
  | "projectType"
  | "invoiceAmount"
  | "bankingChannel"
  | "paidOn"

export type IncomeOptionalColumnId = Exclude<IncomeColumnId, "projectName">

export type IncomeColumnVisibility = Record<IncomeOptionalColumnId, boolean>

export const incomeColumns: readonly ListColumn<IncomeColumnId>[] = [
  { id: "projectName", label: "Project", align: "left", locked: true },
  { id: "projectType", label: "Project Type", align: "left", locked: false },
  { id: "invoiceAmount", label: "Invoice Amount", align: "right", locked: false },
  { id: "bankingChannel", label: "Banking Channel", align: "left", locked: false },
  { id: "paidOn", label: "Paid Date", align: "left", locked: false },
]

const defaultVisibility: IncomeColumnVisibility = {
  projectType: true,
  invoiceAmount: true,
  bankingChannel: true,
  paidOn: true,
}

export function defaultIncomeColumns(): IncomeColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizeIncomeColumns(value: unknown): IncomeColumnVisibility {
  return sanitizeColumnVisibility(
    ["projectType", "invoiceAmount", "bankingChannel", "paidOn"],
    defaultIncomeColumns(),
    value,
  )
}

export type PaymentChannel = {
  id: string
  paidOn: string
  bankAccountId: string
}

export type LedgerChannel = {
  transactionDate: string
  bankAccountId: string
}

export function settlePaidInvoice(
  payments: readonly PaymentChannel[],
  transactions: ReadonlyMap<string, LedgerChannel>,
  accountNames: ReadonlyMap<string, string>,
): { bankingChannel: string; paidOn: string } {
  const channels = payments.map((payment) => {
    const ledger = transactions.get(payment.id)
    const rawDate = ledger?.transactionDate.trim()
      ? ledger.transactionDate
      : payment.paidOn
    const accountId = ledger?.bankAccountId || payment.bankAccountId

    return {
      date: dateInputValue(rawDate),
      name: accountNames.get(accountId)?.trim() ?? "",
    }
  })

  const paidOn =
    channels
      .map((channel) => channel.date)
      .filter((date) => date.length > 0)
      .sort()
      .at(-1) ?? ""

  const names: string[] = []
  const seen = new Set<string>()
  const ordered = [...channels].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  )

  for (const channel of ordered) {
    if (!channel.name || seen.has(channel.name)) {
      continue
    }

    seen.add(channel.name)
    names.push(channel.name)
  }

  return { bankingChannel: names.join(", "), paidOn }
}

export function sortIncome(
  rows: readonly IncomeRow[],
  sort: SortState<IncomeColumnId>,
): IncomeRow[] {
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
  left: IncomeRow,
  right: IncomeRow,
  key: IncomeColumnId,
): number {
  switch (key) {
    case "projectName":
    case "projectType":
    case "bankingChannel":
    case "paidOn":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "invoiceAmount":
      return left.invoiceAmount - right.invoiceAmount
  }
}
