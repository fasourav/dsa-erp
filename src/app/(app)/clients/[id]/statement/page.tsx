import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { ReportFilters } from "@/app/(app)/reports/report-filters"
import { PageHeader } from "@/components/page-header"
import { StatementView } from "@/components/statement-view"
import { allows } from "@/lib/access"
import { isUuid } from "@/lib/ids"
import { reportLaunchDate } from "@/lib/reports/load"
import { clampPeriod, currentReportPeriod, officeToday } from "@/lib/reports/period"
import { getAccess } from "@/lib/permissions"
import {
  getClientProjects,
  loadClientStatement,
  partyDisplayName,
  statementPeriodLabel,
} from "@/lib/statements"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Client Statement" }

const note =
  "Amounts owed follow client invoices. Payments reduce the balance on the date they were received."

export default async function ClientStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string; to?: string; project?: string }>
}) {
  const [{ id }, query, access] = await Promise.all([params, searchParams, getAccess()])
  if (!access || access.status === "deactivated") redirect("/login")
  if (!allows(access, "clients", "view") || !allows(access, "accounts_receivable", "view")) {
    redirect("/no-access")
  }
  if (!access.isOwner && !access.showFinancials) redirect("/no-access")
  if (!isUuid(id)) notFound()

  const supabase = await createClient()
  const [{ data: client }, projects] = await Promise.all([
    supabase.from("clients").select("id, person_name, company_name").eq("id", id).maybeSingle(),
    getClientProjects(id),
  ])
  if (!client) notFound()

  const launch = await reportLaunchDate()
  const today = officeToday()
  const fallback = currentReportPeriod(launch, today)
  const period = clampPeriod(query.from ?? fallback.from, query.to ?? fallback.to, launch, today)
  const project = projects.find((item) => item.id === query.project) ?? null
  const loaded = await loadClientStatement(id, period.from, period.to, project?.id ?? null)
  const partyName = partyDisplayName(client.person_name, client.company_name, "Client")
  const exportQuery = new URLSearchParams({ from: period.from, to: period.to })
  if (project) exportQuery.set("project", project.id)

  if (loaded.status !== "ok") {
    return (
      <div className="flex w-full min-w-0 flex-col gap-3.5">
        <PageHeader eyebrow="Clients" title="Client Statement" description={partyName} />
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

  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host")
  const proto = headerList.get("x-forwarded-proto") ?? "https"
  const qrUrl = host ? `${proto}://${host}/clients/${id}/statement?${exportQuery.toString()}` : null

  return (
    <StatementView
      eyebrow="Clients"
      title="Client Statement"
      partyName={loaded.statement.party || partyName}
      periodLabel={
        project
          ? `${statementPeriodLabel(period.from, period.to)} · ${project.name}`
          : statementPeriodLabel(period.from, period.to)
      }
      debitLabel="Invoices"
      note={note}
      launch={launch}
      today={today}
      from={period.from}
      to={period.to}
      pdfHref={`/clients/${id}/statement/export?${exportQuery.toString()}&format=pdf`}
      excelHref={`/clients/${id}/statement/export?${exportQuery.toString()}&format=xlsx`}
      statement={loaded.statement}
      projects={projects}
      projectId={project?.id ?? null}
      qrUrl={qrUrl}
    />
  )
}
