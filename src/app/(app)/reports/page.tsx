import Link from "next/link"
import { redirect } from "next/navigation"

import { buttonVariants } from "@/components/ui/button"
import { canOpenReports, canSeeReport, homePath } from "@/lib/access"
import { reportDefinitions } from "@/lib/reports/catalog"
import { getAccess } from "@/lib/permissions"

export const metadata = { title: "Reports" }

export default async function ReportsPage() {
  const access = await getAccess()
  if (!access || access.status === "deactivated") redirect("/login")
  if (!canOpenReports(access)) redirect(homePath(access))

  const visible = reportDefinitions.filter((report) => canSeeReport(access, report.slug))

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Reports</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Profit, cash, aging, and tax for a date range. Figures are calculated in the database.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((report) => (
          <Link
            key={report.slug}
            href={`/reports/${report.slug}`}
            className="flex min-h-28 flex-col justify-between rounded-xl border border-border bg-card p-5 hover:bg-accent"
          >
            <span className="font-medium">{report.title}</span>
            <span className="text-sm text-muted-foreground">{report.detail}</span>
          </Link>
        ))}
      </div>
      {access.isOwner ? (
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          <div>
            <h2 className="text-lg font-medium tracking-tight">Backup</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Download every business table. Excel has one sheet per table. JSON is a zip of one file per table. Each download is written to the activity log.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Download routes must not be prefetched. */}
            <a href="/reports/backup?format=xlsx" className={buttonVariants({ variant: "outline" })}>
              Excel Backup
            </a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Download routes must not be prefetched. */}
            <a href="/reports/backup?format=json" className={buttonVariants({ variant: "outline" })}>
              JSON Backup
            </a>
          </div>
        </section>
      ) : null}
    </div>
  )
}
