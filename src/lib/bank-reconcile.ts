import { isBankDirection, type BankDirection } from "@/lib/bank"

export type MatchTolerance = {
  days: number
  label: string
}

export type StatementLine = {
  id: string
  lineDate: string
  description: string
  direction: BankDirection
  amount: number
  reference: string
  bankTransactionId: string | null
}

export type ReconciliationBundle = {
  status: "ready" | "missing" | "error"
  error: string | null
  tolerances: MatchTolerance[]
  lines: StatementLine[]
  periods: LockedPeriod[]
}

export type LockedPeriod = {
  id: string
  periodStart: string
  periodEnd: string
  statementBalance: number
  bookBalance: number
  difference: number
}

export type ParsedStatementLine = {
  lineDate: string
  description: string
  direction: BankDirection
  amount: number
  reference: string
}

export function parseStatementCsv(text: string): { rows: ParsedStatementLine[]; error: string | null } {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length < 2) return { rows: [], error: "The file needs a header and at least one line." }

  const header = splitCsv(lines[0]).map((cell) => cell.trim().toLowerCase())
  const dateIndex = header.findIndex((cell) => cell === "date" || cell === "txn date" || cell === "value date")
  const descriptionIndex = header.findIndex((cell) =>
    ["description", "narration", "particulars", "details"].includes(cell),
  )
  const amountIndex = header.findIndex((cell) => cell === "amount")
  const debitIndex = header.findIndex((cell) => cell === "debit" || cell === "withdrawal")
  const creditIndex = header.findIndex((cell) => cell === "credit" || cell === "deposit")
  const directionIndex = header.findIndex((cell) => cell === "direction" || cell === "type")
  const referenceIndex = header.findIndex((cell) => cell === "reference" || cell === "ref" || cell === "cheque")

  if (dateIndex < 0 || (amountIndex < 0 && debitIndex < 0 && creditIndex < 0)) {
    return {
      rows: [],
      error: "Use columns for Date and Amount, or Date, Debit, and Credit.",
    }
  }

  const rows: ParsedStatementLine[] = []
  for (const line of lines.slice(1)) {
    const cells = splitCsv(line)
    const lineDate = parseStatementDate(cells[dateIndex] ?? "")
    if (!lineDate) return { rows: [], error: "One of the dates could not be read. Use YYYY-MM-DD or DD/MM/YYYY." }
    const description = descriptionIndex >= 0 ? (cells[descriptionIndex] ?? "").trim() : ""
    const reference = referenceIndex >= 0 ? (cells[referenceIndex] ?? "").trim() : ""
    const parsed = amountOf(
      amountIndex >= 0 ? cells[amountIndex] : "",
      debitIndex >= 0 ? cells[debitIndex] : "",
      creditIndex >= 0 ? cells[creditIndex] : "",
      directionIndex >= 0 ? cells[directionIndex] : "",
    )
    if (!parsed) return { rows: [], error: "One of the amounts could not be read." }
    rows.push({ lineDate, description, reference, ...parsed })
  }
  return { rows, error: null }
}

function amountOf(
  amountText: string,
  debitText: string,
  creditText: string,
  directionText: string,
): { direction: BankDirection; amount: number } | null {
  const debit = money(debitText)
  const credit = money(creditText)
  if (debit != null && debit > 0) return { direction: "outflow", amount: debit }
  if (credit != null && credit > 0) return { direction: "inflow", amount: credit }
  const amount = money(amountText)
  if (amount == null || amount === 0) return null
  const directionWord = directionText.trim().toLowerCase()
  if (isBankDirection(directionWord)) {
    return { direction: directionWord, amount: Math.abs(amount) }
  }
  if (directionWord === "credit" || directionWord === "in") {
    return { direction: "inflow", amount: Math.abs(amount) }
  }
  if (directionWord === "debit" || directionWord === "out") {
    return { direction: "outflow", amount: Math.abs(amount) }
  }
  return { direction: amount > 0 ? "inflow" : "outflow", amount: Math.abs(amount) }
}

function money(value: string): number | null {
  const cleaned = value.trim().replace(/[৳,\s]/g, "")
  if (!cleaned || cleaned === "-") return null
  const amount = Number(cleaned)
  if (!Number.isFinite(amount)) return null
  return Math.round(amount * 100) / 100
}

function parseStatementDate(value: string): string | null {
  const text = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text)
  if (!local) return null
  const day = local[1].padStart(2, "0")
  const month = local[2].padStart(2, "0")
  const candidate = `${local[3]}-${month}-${day}`
  return Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31
    ? candidate
    : null
}

function splitCsv(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        quoted = !quoted
      }
      continue
    }
    if (char === "," && !quoted) {
      cells.push(current)
      current = ""
      continue
    }
    current += char
  }
  cells.push(current)
  return cells
}

export function periodLocked(periods: LockedPeriod[], day: string): boolean {
  return periods.some((period) => day >= period.periodStart && day <= period.periodEnd)
}

export function periodOverlaps(periods: LockedPeriod[], from: string, to: string): boolean {
  return periods.some((period) => period.periodStart <= to && from <= period.periodEnd)
}

export function bookBalanceAsOf(
  openingBalance: number,
  rows: readonly { transactionDate: string; direction: BankDirection; amount: number }[],
  asOf: string,
): number {
  const movement = rows.reduce((sum, row) => {
    if (!row.transactionDate || row.transactionDate > asOf) return sum
    return sum + (row.direction === "inflow" ? row.amount : -row.amount)
  }, openingBalance)
  return Math.round(movement * 100) / 100
}

export function defaultToleranceDays(tolerances: readonly MatchTolerance[]): number | null {
  if (tolerances.length === 0) return null
  return tolerances.find((row) => row.days === 3)?.days ?? tolerances[0].days
}
