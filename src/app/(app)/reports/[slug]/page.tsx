import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { ReportView } from "@/app/(app)/reports/report-view"
import { ReportFilters } from "@/app/(app)/reports/report-filters"
import { canOpenReports, canSeeReport, homePath } from "@/lib/access"
import { isReportSlug, reportBySlug } from "@/lib/reports/catalog"
import { loadFinancialReport, reportLaunchDate } from "@/lib/reports/load"
import { clampPeriod, currentReportPeriod, officeToday } from "@/lib/reports/period"
import { buildReport } from "@/lib/reports/tables"
import { getAccess } from "@/lib/permissions"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  if (!isReportSlug(slug)) return { title: "Report" }
  return { title: reportBySlug(slug).title }
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const [{ slug }, query, access] = await Promise.all([
    params,
    searchParams,
    getAccess(),
  ])
  if (!isReportSlug(slug)) notFound()
  if (!access || access.status === "deactivated") redirect("/login")
  if (!canOpenReports(access) || !canSeeReport(access, slug)) redirect(homePath(access))

  const launch = await reportLaunchDate()
  const today = officeToday()
  const fallback = currentReportPeriod(launch, today)
  const period = clampPeriod(query.from ?? fallback.from, query.to ?? fallback.to, launch, today)
  const definition = reportBySlug(slug)
  const loaded = await loadFinancialReport(period.from, period.to)
  const exportQuery = new URLSearchParams({
    report: slug,
    from: period.from,
    to: period.to,
  })

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
      {loaded.status === "ok" ? (
        <LoadedReport
          slug={slug}
          title={definition.title}
          report={loaded.report}
          launch={launch}
          today={today}
          from={period.from}
          to={period.to}
          exportQuery={exportQuery}
        />
      ) : (
        <>
          <div>
            <p className="text-sm text-muted-foreground">Reports</p>
            <h1 className="text-2xl font-medium tracking-tight">{definition.title}</h1>
          </div>
          <ReportFilters launch={launch} today={today} from={period.from} to={period.to} />
          <p role="alert" className="text-sm text-destructive">
            {loaded.status === "missing"
              ? "Financial reports are not installed on this database yet. Apply the reports migration, then reload."
              : loaded.status === "denied"
                ? "You do not have access to this report."
                : "Could not calculate this report."}
          </p>
        </>
      )}
    </div>
  )
}

function LoadedReport({
  slug,
  title,
  report,
  launch,
  today,
  from,
  to,
  exportQuery,
}: {
  slug: Parameters<typeof buildReport>[0]
  title: string
  report: Parameters<typeof buildReport>[2]
  launch: string
  today: string
  from: string
  to: string
  exportQuery: URLSearchParams
}) {
  const built = buildReport(slug, title, report)
  if (!built) {
    return (
      <>
        <div>
          <p className="text-sm text-muted-foreground">Reports</p>
          <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
        </div>
        <ReportFilters launch={launch} today={today} from={from} to={to} />
        <p role="alert" className="text-sm text-destructive">
          You do not have access to this report.
        </p>
      </>
    )
  }

  return (
    <ReportView
      report={built}
      launch={launch}
      today={today}
      from={from}
      to={to}
      pdfHref={`/reports/export?${exportQuery.toString()}&format=pdf`}
      excelHref={`/reports/export?${exportQuery.toString()}&format=xlsx`}
    />
  )
}
