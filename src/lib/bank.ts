import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import { moneyCents } from "@/lib/payment-status"

export const bankDirections = ["inflow", "outflow"] as const
export type BankDirection = (typeof bankDirections)[number]

export const bankSourceKinds = [
  "project_income",
  "vendor_expense",
  "operational_expense",
  "vat_tax",
  "other",
] as const
export type BankSourceKind = (typeof bankSourceKinds)[number]

export function isBankDirection(value: string): value is BankDirection {
  return bankDirections.includes(value as BankDirection)
}

export function isBankSourceKind(value: string): value is BankSourceKind {
  return bankSourceKinds.includes(value as BankSourceKind)
}

export function bankDirectionLabel(direction: BankDirection): string {
  return direction === "inflow" ? "Inflow" : "Outflow"
}

export function bankSourceLabel(source: BankSourceKind): string {
  switch (source) {
    case "project_income":
      return "Project Income"
    case "vendor_expense":
      return "Vendor Expense"
    case "operational_expense":
      return "Operational Expense"
    case "vat_tax":
      return "VAT / Tax"
    case "other":
      return "Other"
  }
}

export function bankFlowLabel(direction: BankDirection): string {
  return direction === "inflow" ? "Incoming" : "Outgoing"
}

export type BankAccountRow = {
  id: string
  name: string
  bankName: string
  currency: string
  isActive: boolean
}

export type BankTransactionRow = {
  id: string
  bankAccountId: string
  accountName: string
  transactionDate: string
  direction: BankDirection
  amount: number
  sourceKind: BankSourceKind
  paymentMethod: string
  projectId: string
  projectName: string
  notes: string
  balance: number
}

export type AccountFilter = {
  id: string
  name: string
}

export type BankAccountColumnId = "name" | "bankName" | "currency" | "isActive"
export type BankAccountOptionalColumnId = Exclude<BankAccountColumnId, "name">
export type BankAccountColumnVisibility = Record<
  BankAccountOptionalColumnId,
  boolean
>

export const bankAccountColumns: readonly ListColumn<BankAccountColumnId>[] = [
  { id: "name", label: "Account", align: "left", locked: true },
  { id: "bankName", label: "Bank", align: "left", locked: false },
  { id: "currency", label: "Currency", align: "left", locked: false },
  { id: "isActive", label: "Status", align: "left", locked: false },
]

const accountVisibility: BankAccountColumnVisibility = {
  bankName: true,
  currency: true,
  isActive: true,
}

export function defaultBankAccountColumns(): BankAccountColumnVisibility {
  return { ...accountVisibility }
}

export function sanitizeBankAccountColumns(
  value: unknown,
): BankAccountColumnVisibility {
  return sanitizeColumnVisibility(
    ["bankName", "currency", "isActive"],
    defaultBankAccountColumns(),
    value,
  )
}

export type BankTransactionColumnId =
  | "transactionDate"
  | "accountName"
  | "direction"
  | "sourceKind"
  | "amount"
  | "balance"

export type BankTransactionOptionalColumnId = Exclude<
  BankTransactionColumnId,
  "transactionDate" | "accountName"
>

export type BankTransactionColumnVisibility = Record<
  BankTransactionOptionalColumnId,
  boolean
>

export const bankTransactionColumns: readonly ListColumn<BankTransactionColumnId>[] =
  [
    { id: "transactionDate", label: "Date", align: "left", locked: true },
    { id: "accountName", label: "Account", align: "left", locked: true },
    { id: "direction", label: "Direction", align: "left", locked: false },
    { id: "sourceKind", label: "Source", align: "left", locked: false },
    { id: "amount", label: "Amount", align: "right", locked: false },
    { id: "balance", label: "Balance", align: "right", locked: false },
  ]

const transactionVisibility: BankTransactionColumnVisibility = {
  direction: true,
  sourceKind: true,
  amount: true,
  balance: true,
}

export function defaultBankTransactionColumns(): BankTransactionColumnVisibility {
  return { ...transactionVisibility }
}

export function sanitizeBankTransactionColumns(
  value: unknown,
): BankTransactionColumnVisibility {
  return sanitizeColumnVisibility(
    ["direction", "sourceKind", "amount", "balance"],
    defaultBankTransactionColumns(),
    value,
  )
}

export function sortBankAccounts(
  rows: readonly BankAccountRow[],
  sort: SortState<BankAccountColumnId>,
): BankAccountRow[] {
  const direction = sort.direction === "asc" ? 1 : -1
  return [...rows].sort((left, right) => {
    const primary = compareAccounts(left, right, sort.key) * direction
    return primary === 0 ? left.id.localeCompare(right.id) : primary
  })
}

function compareAccounts(
  left: BankAccountRow,
  right: BankAccountRow,
  key: BankAccountColumnId,
): number {
  switch (key) {
    case "name":
    case "bankName":
    case "currency":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "isActive":
      return Number(left.isActive) - Number(right.isActive)
  }
}

export function sortBankTransactions(
  rows: readonly BankTransactionRow[],
  sort: SortState<BankTransactionColumnId>,
): BankTransactionRow[] {
  const direction = sort.direction === "asc" ? 1 : -1
  return [...rows].sort((left, right) => {
    const primary = compareTransactions(left, right, sort.key) * direction
    if (primary !== 0) {
      return primary
    }

    return (
      right.transactionDate.localeCompare(left.transactionDate) ||
      left.id.localeCompare(right.id)
    )
  })
}

function compareTransactions(
  left: BankTransactionRow,
  right: BankTransactionRow,
  key: BankTransactionColumnId,
): number {
  switch (key) {
    case "transactionDate":
    case "accountName":
    case "direction":
    case "sourceKind":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "amount":
    case "balance":
      return left[key] - right[key]
  }
}

export function withRunningBalances(
  rows: readonly Omit<BankTransactionRow, "balance">[],
): BankTransactionRow[] {
  const groups = new Map<string, Omit<BankTransactionRow, "balance">[]>()

  for (const row of rows) {
    const key = row.bankAccountId || row.id
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const balanceById = new Map<string, number>()

  for (const group of groups.values()) {
    const ordered = [...group].sort((left, right) => {
      const byDate = left.transactionDate.localeCompare(right.transactionDate)
      if (byDate !== 0) {
        return byDate
      }

      return left.id.localeCompare(right.id)
    })

    let cents = 0
    for (const row of ordered) {
      const signed =
        row.direction === "inflow"
          ? moneyCents(row.amount)
          : -moneyCents(row.amount)
      cents += signed
      balanceById.set(row.id, cents / 100)
    }
  }

  return rows.map((row) => ({
    ...row,
    balance: balanceById.get(row.id) ?? 0,
  }))
}
