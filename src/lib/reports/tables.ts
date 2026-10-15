import { formatDayMonYear } from "@/lib/format"
import type {
  AgingReport,
  BuiltReport,
  FinancialReport,
  ProjectProfitReport,
  ReportSlug,
  ReportTable,
  StatementLine,
  TaxReport,
} from "@/lib/reports/types"

function statementTable(title: string, lines: StatementLine[]): ReportTable {
  return {
    title,
    columns: [
      { header: "Line", kind: "text" },
      { header: "Amount", kind: "money" },
    ],
    rows: lines.map((line) => ({
      cells: [line.label, line.amount],
      emphasis: line.emphasis,
    })),
  }
}

function dated(value: string): string {
  return value ? formatDayMonYear(value) : "—"
}

function agingTables(title: string, aging: AgingReport, countHeader: string): ReportTable[] {
  return [
    {
      title: `${title} Summary`,
      columns: [
        { header: "Bucket", kind: "text" },
        { header: countHeader, kind: "integer" },
        { header: "Amount", kind: "money" },
      ],
      rows: [
        ...aging.buckets.map((bucket) => ({
          cells: [bucket.label, bucket.count, bucket.amount] as Array<string | number | null>,
          emphasis: "plain" as const,
        })),
        {
          cells: ["Total", aging.rows.length, aging.total],
          emphasis: "total",
        },
      ],
    },
    {
      title,
      columns: [
        { header: "Party", kind: "text" },
        { header: "Project", kind: "text" },
        { header: "Reference", kind: "text" },
        { header: "Due", kind: "text" },
        { header: "Days", kind: "integer" },
        { header: "Bucket", kind: "text" },
        { header: "Amount", kind: "money" },
      ],
      rows: [
        ...aging.rows.map((row) => ({
          cells: [
            row.party,
            row.project,
            row.reference,
            dated(row.dueOn),
            row.days,
            row.bucket,
            row.amount,
          ] as Array<string | number | null>,
          emphasis: "plain" as const,
        })),
        {
          cells: ["Total", "", "", "", "", "", aging.total],
          emphasis: "total",
        },
      ],
    },
  ]
}

function projectTable(report: ProjectProfitReport): ReportTable {
  return {
    title: "Project Profitability",
    columns: [
      { header: "Project", kind: "text" },
      { header: "Client", kind: "text" },
      { header: "Revenue", kind: "money" },
      { header: "Project Expense", kind: "money" },
      { header: "Tax", kind: "money" },
      { header: "Gross Profit", kind: "money" },
    ],
    rows: [
      ...report.rows.map((row) => ({
        cells: [
          row.project,
          row.client,
          row.revenue,
          row.projectExpense,
          row.tax,
          row.grossProfit,
        ] as Array<string | number | null>,
        emphasis: "plain" as const,
      })),
      {
        cells: [
          "Total",
          "",
          report.totals.revenue,
          report.totals.projectExpense,
          report.totals.tax,
          report.totals.grossProfit,
        ],
        emphasis: "total",
      },
    ],
  }
}

function taxTables(report: TaxReport): ReportTable[] {
  return [
    {
      title: "Tax By Project",
      columns: [
        { header: "Project", kind: "text" },
        { header: "Payments", kind: "integer" },
        { header: "Amount", kind: "money" },
      ],
      rows: [
        ...report.byProject.map((row) => ({
          cells: [row.project, row.count, row.amount] as Array<string | number | null>,
          emphasis: "plain" as const,
        })),
        {
          cells: ["Total", report.lines.length, report.total],
          emphasis: "total",
        },
      ],
    },
    {
      title: "Tax Payments",
      columns: [
        { header: "Paid On", kind: "text" },
        { header: "Project", kind: "text" },
        { header: "Method", kind: "text" },
        { header: "Notes", kind: "text" },
        { header: "Amount", kind: "money" },
      ],
      rows: [
        ...report.lines.map((line) => ({
          cells: [
            dated(line.paidOn),
            line.project,
            line.method,
            line.notes || "—",
            line.amount,
          ] as Array<string | number | null>,
          emphasis: "plain" as const,
        })),
        {
          cells: ["Total", "", "", "", report.total],
          emphasis: "total",
        },
      ],
    },
  ]
}

export function buildReport(
  slug: ReportSlug,
  title: string,
  report: FinancialReport,
): BuiltReport | null {
  const periodLabel = `${formatDayMonYear(report.from)} – ${formatDayMonYear(report.to)}`
  const asOf = `As of ${formatDayMonYear(report.to)}`

  switch (slug) {
    case "profit-and-loss":
      if (!report.profitAndLoss) return null
      return {
        title,
        periodLabel,
        landscape: false,
        tables: [statementTable(title, report.profitAndLoss.lines)],
        notes: [
          "Accrual basis: revenue is counted on the client invoice date and vendor costs on the vendor bill date. Gross Profit is project revenue minus project expense and tax. Net Profit subtracts admin expense (operational, marketing, salaries, office admin, and depreciation). The dashboard shows cash received and paid, so its figures can differ.",
        ],
      }
    case "cash-flow":
      if (!report.cashFlow) return null
      return {
        title,
        periodLabel,
        landscape: false,
        tables: [statementTable(title, report.cashFlow.lines)],
        notes: [
          "Inflows are positive and outflows are negative, so the movement lines add up to the net change. Opening cash is the balance before this period. Closing cash is the balance on the end date.",
        ],
      }
    case "balance-sheet":
      if (!report.balanceSheet) return null
      return {
        title,
        periodLabel: asOf,
        landscape: false,
        tables: [statementTable(title, report.balanceSheet.lines)],
        notes: [
          report.balanceSheet.partial
            ? "Some lines are hidden because this login cannot view every source. Difference is omitted so a partial sheet does not look unbalanced."
            : "Accrual basis: receivables come from client invoices and payables from vendor bills. Equity is opening capital, assets added, owner deposits and withdrawals, and retained earnings. Difference is assets minus liabilities minus equity and should be zero.",
        ],
      }
    case "ar-aging":
      if (!report.arAging) return null
      return {
        title,
        periodLabel: asOf,
        landscape: true,
        tables: agingTables(title, report.arAging, "Invoices"),
        notes: [
          "Open client invoices as of the end date. Days run up to today or the end date, whichever is earlier, counting from the due date, or the issue date when no due date is set. The 0-30 bucket includes amounts that are not yet due.",
        ],
      }
    case "ap-aging":
      if (!report.apAging) return null
      return {
        title,
        periodLabel: asOf,
        landscape: true,
        tables: agingTables(title, report.apAging, "Bills"),
        notes: [
          "Open vendor bills as of the end date, including bills on operational orders. Days run up to today or the end date, whichever is earlier, counting from the bill due date, or the bill date when no due date is set. The 0-30 bucket includes amounts that are not yet due.",
        ],
      }
    case "project-profitability":
      if (!report.projectProfitability) return null
      return {
        title,
        periodLabel,
        landscape: true,
        tables: [projectTable(report.projectProfitability)],
        notes: [
          "Accrual basis: revenue on the client invoice date and vendor cost on the vendor bill date. Gross profit is project revenue minus project expense and tax.",
        ],
      }
    case "tax":
      if (!report.tax) return null
      return {
        title,
        periodLabel,
        landscape: false,
        tables: taxTables(report.tax),
        notes: ["Tax payments recorded in the selected period, grouped by project name."],
      }
  }
}
