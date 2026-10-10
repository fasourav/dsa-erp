import { bankSourceLabel, type BankTransactionRow } from "@/lib/bank"
import { moneyCents } from "@/lib/payment-status"

export type StatementLine = {
  id: string
  date: string
  description: string
  project: string
  moneyIn: number
  moneyOut: number
  runningBalance: number
}

export type BankStatement = {
  opening: number
  lines: StatementLine[]
  totalIn: number
  totalOut: number
  closing: number
}

export function buildBankStatement(input: {
  accountIds: readonly string[]
  openingBalance: number
  transactions: readonly BankTransactionRow[]
  from: string
  to: string
  showAccount: boolean
}): BankStatement {
  const included = new Set(input.accountIds)
  const rows = input.transactions
    .filter((row) => included.has(row.bankAccountId) && row.transactionDate)
    .sort((left, right) => {
      const byDate = left.transactionDate.localeCompare(right.transactionDate)
      return byDate === 0 ? left.id.localeCompare(right.id) : byDate
    })

  let cents = moneyCents(input.openingBalance)
  for (const row of rows) {
    if (row.transactionDate >= input.from) {
      break
    }
    cents += signedCents(row)
  }

  const opening = cents / 100
  const lines: StatementLine[] = []
  let totalIn = 0
  let totalOut = 0

  for (const row of rows) {
    if (row.transactionDate < input.from || row.transactionDate > input.to) {
      continue
    }

    const moneyIn = row.direction === "inflow" ? row.amount : 0
    const moneyOut = row.direction === "outflow" ? row.amount : 0
    cents += signedCents(row)
    totalIn += moneyIn
    totalOut += moneyOut
    lines.push({
      id: row.id,
      date: row.transactionDate,
      description: describeLine(row, input.showAccount),
      project: row.projectName,
      moneyIn,
      moneyOut,
      runningBalance: cents / 100,
    })
  }

  return {
    opening,
    lines,
    totalIn,
    totalOut,
    closing: cents / 100,
  }
}

function signedCents(row: BankTransactionRow): number {
  const cents = moneyCents(row.amount)
  return row.direction === "inflow" ? cents : -cents
}

function describeLine(row: BankTransactionRow, showAccount: boolean): string {
  const source = bankSourceLabel(row.sourceKind)
  const notes = row.notes.trim()
  const detail = notes && notes !== source ? `${source} · ${notes}` : notes || source
  if (showAccount && row.accountName) {
    return `${row.accountName} · ${detail}`
  }
  return detail
}
