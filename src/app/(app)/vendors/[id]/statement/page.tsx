import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { StatementView } from "@/components/statement-view"
import { PageHeader } from "@/components/page-header"
import { ReportFilters } from "@/app/(app)/reports/report-filters"
import { allows, homePath } from "@/lib/access"
import { isUuid } from "@/lib/ids"
import { reportLaunchDate } from "@/lib/reports/load"
import { clampPeriod, currentReportPeriod, officeToday } from "@/lib/reports/period"
import { getAccess } from "@/lib/permissions"
import {
  loadVendorStatement,
  partyDisplayName,
  statementPeriodLabel,
} from "@/lib/statements"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Vendor Statement" }

const note =
  "Amounts owed follow vendor bills. A purchase order is shown only as the bill reference and is not an amount owed."

export default async function VendorStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const [{ id }, query, access] = await Promise.all([params, searchParams, getAccess()])
  if (!access || access.status === "deactivated") redirect("/login")
  if (!allows(access, "vendors", "view") || !allows(access, "accounts_payable", "view")) {
    redirect(homePath(access))
  }
  if (!isUuid(id)) notFound()

  const supabase = await createClient()
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, person_name, company_name")
    .eq("id", id)
    .maybeSingle()
  if (!vendor) notFound()

  const launch = await reportLaunchDate()
  const today = officeToday()
  const fallback = currentReportPeriod(launch, today)
  const period = clampPeriod(query.from ?? fallback.from, query.to ?? fallback.to, launch, today)
  const loaded = await loadVendorStatement(id, period.from, period.to)
  const partyName = partyDisplayName(vendor.person_name, vendor.company_name, "Vendor")
  const exportQuery = new URLSearchParams({ from: period.from, to: period.to })

  if (loaded.status !== "ok") {
    return (
      <div className="flex w-full min-w-0 flex-col gap-3.5">
        <PageHeader eyebrow="Vendors" title="Vendor Statement" description={partyName} />
        <ReportFilters launch={launch} today={today} from={period.from} to={period.to} />
        <p role="alert" className="text-sm text-destructive">
          {loaded.status === "missing"
            ? "Statements are not installed on this database yet. Apply the statements migration, then reload."
            : loaded.status === "denied"
              ? "You do not have access to this statement."
              : "Could not calculate this statement."}
        </p>
      </div>
    )
  }

  return (
    <StatementView
      eyebrow="Vendors"
      title="Vendor Statement"
      partyName={loaded.statement.party || partyName}
      periodLabel={statementPeriodLabel(period.from, period.to)}
      debitLabel="Bills"
      note={note}
      launch={launch}
      today={today}
      from={period.from}
      to={period.to}
      pdfHref={`/vendors/${id}/statement/export?${exportQuery.toString()}&format=pdf`}
      excelHref={`/vendors/${id}/statement/export?${exportQuery.toString()}&format=xlsx`}
      statement={loaded.statement}
    />
  )
}
