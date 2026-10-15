import type { ReportSlug } from "@/lib/reports/types"

export const reportCompanyName = "DynamicSpace Architects & Engineers"

export const reportDefinitions: Array<{
  slug: ReportSlug
  title: string
  detail: string
}> = [
  {
    slug: "profit-and-loss",
    title: "Profit & Loss",
    detail: "Project revenue, project expense, tax, and admin expense.",
  },
  {
    slug: "balance-sheet",
    title: "Balance Sheet",
    detail: "Cash, receivables, assets, payables, and equity as of the end date.",
  },
  {
    slug: "cash-flow",
    title: "Cash Flow",
    detail: "Opening cash, movements, and closing cash for the period.",
  },
  {
    slug: "ar-aging",
    title: "Accounts Receivable Aging",
    detail: "Open client invoices in 0-30, 31-60, 61-90, and 90+ days.",
  },
  {
    slug: "ap-aging",
    title: "Accounts Payable Aging",
    detail: "Open vendor bills in 0-30, 31-60, 61-90, and 90+ days.",
  },
  {
    slug: "project-profitability",
    title: "Project Profitability",
    detail: "Revenue, project expense, tax, and gross profit by project.",
  },
  {
    slug: "project-budget",
    title: "Project Budget",
    detail: "Planned, committed, actual, and remaining amounts by project and category.",
  },
  {
    slug: "tax",
    title: "Tax Summary",
    detail: "VAT and tax payments in the period.",
  },
]

export function isReportSlug(value: string): value is ReportSlug {
  return reportDefinitions.some((report) => report.slug === value)
}

export function reportBySlug(slug: ReportSlug) {
  const report = reportDefinitions.find((item) => item.slug === slug)
  if (!report) {
    throw new Error("Unknown report.")
  }
  return report
}
