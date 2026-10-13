import type {
  AgingReport,
  Emphasis,
  FinancialReport,
  ProjectProfitReport,
  StatementLine,
  TaxReport,
} from "@/lib/reports/types"

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function amount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return 0
}

function whole(value: unknown): number {
  return Math.trunc(amount(value))
}

function text(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed || fallback
}

function emphasis(value: unknown): Emphasis {
  if (value === "subtotal" || value === "total") return value
  return "plain"
}

function lines(value: unknown): StatementLine[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => {
    const row = record(item)
    return {
      label: text(row?.label, "Line"),
      amount: amount(row?.amount),
      emphasis: emphasis(row?.emphasis),
    }
  })
}

function aging(value: unknown): AgingReport | null {
  const body = record(value)
  if (!body) return null
  const buckets = Array.isArray(body.buckets)
    ? body.buckets.map((item) => {
        const row = record(item)
        return {
          label: text(row?.label, "0-30"),
          amount: amount(row?.amount),
          count: whole(row?.count),
        }
      })
    : []
  const rows = Array.isArray(body.rows)
    ? body.rows.map((item) => {
        const row = record(item)
        return {
          party: text(row?.party, "—"),
          project: text(row?.project, "—"),
          reference: text(row?.reference, "—"),
          dueOn: text(row?.due_on, ""),
          days: whole(row?.days),
          bucket: text(row?.bucket, "0-30"),
          amount: amount(row?.amount),
        }
      })
    : []
  return { buckets, rows, total: amount(body.total) }
}

function projects(value: unknown): ProjectProfitReport | null {
  const body = record(value)
  if (!body) return null
  const totals = record(body.totals)
  return {
    rows: Array.isArray(body.rows)
      ? body.rows.map((item) => {
          const row = record(item)
          return {
            project: text(row?.project, "Project"),
            client: text(row?.client, "—"),
            revenue: amount(row?.revenue),
            projectExpense: amount(row?.project_expense),
            tax: amount(row?.tax),
            grossProfit: amount(row?.gross_profit),
          }
        })
      : [],
    totals: {
      revenue: amount(totals?.revenue),
      projectExpense: amount(totals?.project_expense),
      tax: amount(totals?.tax),
      grossProfit: amount(totals?.gross_profit),
    },
  }
}

function tax(value: unknown): TaxReport | null {
  const body = record(value)
  if (!body) return null
  return {
    byProject: Array.isArray(body.by_project)
      ? body.by_project.map((item) => {
          const row = record(item)
          return {
            project: text(row?.project, "Project"),
            amount: amount(row?.amount),
            count: whole(row?.count),
          }
        })
      : [],
    lines: Array.isArray(body.lines)
      ? body.lines.map((item) => {
          const row = record(item)
          return {
            paidOn: text(row?.paid_on, ""),
            project: text(row?.project, "Project"),
            method: text(row?.method, "—"),
            notes: typeof row?.notes === "string" ? row.notes : "",
            amount: amount(row?.amount),
          }
        })
      : [],
    total: amount(body.total),
  }
}

export function parseFinancialReport(value: unknown): FinancialReport | null {
  const body = record(value)
  if (!body || body.allowed !== true) return null
  const profit = record(body.profit_and_loss)
  const cash = record(body.cash_flow)
  const balance = record(body.balance_sheet)
  return {
    allowed: true,
    from: text(body.from, ""),
    to: text(body.to, ""),
    profitAndLoss: profit ? { lines: lines(profit.lines) } : null,
    cashFlow: cash ? { lines: lines(cash.lines) } : null,
    balanceSheet: balance
      ? { lines: lines(balance.lines), partial: balance.partial === true }
      : null,
    arAging: aging(body.ar_aging),
    apAging: aging(body.ap_aging),
    projectProfitability: projects(body.project_profitability),
    tax: tax(body.tax),
  }
}

export function isMissingReportFunction(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    /could not find the function/i.test(error.message ?? "")
  )
}
