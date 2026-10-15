import Link from "next/link"
import { redirect } from "next/navigation"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Calculator,
  FileBarChart,
  FileSpreadsheet,
  FolderKanban,
  Gauge,
  Scale,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { canOpenReports, canSeeReport, homePath } from "@/lib/access"
import { reportDefinitions } from "@/lib/reports/catalog"
import type { ReportSlug } from "@/lib/reports/types"
import { getAccess } from "@/lib/permissions"
import { cn } from "@/lib/utils"

export const metadata = { title: "Reports" }

const chartTiles = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"] as const

const reportIcons: Record<ReportSlug, LucideIcon> = {
  "profit-and-loss": TrendingUp,
  "balance-sheet": Scale,
  "cash-flow": Wallet,
  "ar-aging": ArrowDownLeft,
  "ap-aging": ArrowUpRight,
  "project-profitability": FolderKanban,
  "project-budget": Gauge,
  tax: Calculator,
}

export default async function ReportsPage() {
  const access = await getAccess()
  if (!access || access.status === "deactivated") redirect("/login")
  if (!canOpenReports(access)) redirect(homePath(access))

  const visible = reportDefinitions.filter((report) => canSeeReport(access, report.slug))

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <PageHeader
        title="Reports"
        description="Profit, cash, aging, and tax for a date range. Figures are calculated in the database."
      />
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((report, index) => {
          const Icon = reportIcons[report.slug] ?? FileBarChart
          return (
            <Link
              key={report.slug}
              href={`/reports/${report.slug}`}
              className="block rounded-card focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full gap-3 transition-colors hover:bg-fill">
                <CardContent className="flex flex-col gap-3">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-tile text-on-color tile-sheen",
                      chartTiles[index % chartTiles.length],
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-panel-title">{report.title}</span>
                  <span className="text-label text-muted-foreground">{report.detail}</span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
      {access.isOwner ? (
        <Card>
          <CardHeader>
            <CardTitle>Backup</CardTitle>
            <CardDescription>
              Download every business table. Excel has one sheet per table. JSON is a zip of one file per table. Each download is written to the activity log.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col items-stretch gap-2 md:flex-row md:items-center">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Download routes must not be prefetched. */}
            <a href="/reports/backup?format=xlsx" className={buttonVariants({ variant: "outline" })}>
              <FileSpreadsheet aria-hidden="true" data-icon="inline-start" />
              Excel Backup
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Download routes must not be prefetched. */}
            <a href="/reports/backup?format=json" className={buttonVariants({ variant: "outline" })}>
              <FileBarChart aria-hidden="true" data-icon="inline-start" />
              JSON Backup
            </a>
          </CardFooter>
        </Card>
      ) : null}
    </div>
  )
}
