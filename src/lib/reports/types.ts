export type Emphasis = "plain" | "subtotal" | "total"

export type StatementLine = {
  label: string
  amount: number
  emphasis: Emphasis
}

export type AgingBucket = {
  label: string
  amount: number
  count: number
}

export type AgingRow = {
  party: string
  project: string
  reference: string
  dueOn: string
  days: number
  bucket: string
  amount: number
}

export type AgingReport = {
  buckets: AgingBucket[]
  rows: AgingRow[]
  total: number
}

export type ProjectProfitRow = {
  project: string
  client: string
  revenue: number
  projectExpense: number
  tax: number
  grossProfit: number
}

export type ProjectProfitReport = {
  rows: ProjectProfitRow[]
  totals: {
    revenue: number
    projectExpense: number
    tax: number
    grossProfit: number
  }
}

export type TaxByProject = {
  project: string
  amount: number
  count: number
}

export type TaxLine = {
  paidOn: string
  project: string
  method: string
  notes: string
  amount: number
}

export type TaxReport = {
  byProject: TaxByProject[]
  lines: TaxLine[]
  total: number
}

export type FinancialReport = {
  allowed: boolean
  from: string
  to: string
  profitAndLoss: { lines: StatementLine[] } | null
  cashFlow: { lines: StatementLine[] } | null
  balanceSheet: { lines: StatementLine[]; partial: boolean } | null
  arAging: AgingReport | null
  apAging: AgingReport | null
  projectProfitability: ProjectProfitReport | null
  tax: TaxReport | null
}

export type ReportSlug =
  | "profit-and-loss"
  | "balance-sheet"
  | "cash-flow"
  | "ar-aging"
  | "ap-aging"
  | "project-profitability"
  | "tax"

export type ExportKind = "text" | "money" | "integer"

export type ReportColumn = {
  header: string
  kind: ExportKind
}

export type ReportRow = {
  cells: Array<string | number | null>
  emphasis: Emphasis
}

export type ReportTable = {
  title: string
  columns: ReportColumn[]
  rows: ReportRow[]
}

export type BuiltReport = {
  title: string
  periodLabel: string
  tables: ReportTable[]
  notes: string[]
  landscape: boolean
}
