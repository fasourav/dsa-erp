import { NextResponse } from "next/server"

import { allows } from "@/lib/access"
import { isUuid } from "@/lib/ids"
import { buildReportPdf } from "@/lib/reports/pdf"
import { reportLaunchDate } from "@/lib/reports/load"
import { clampPeriod, officeToday } from "@/lib/reports/period"
import { buildReportWorkbook, safeFilename } from "@/lib/reports/workbook"
import { getAccess } from "@/lib/permissions"
import {
  buildStatementReport,
  getClientProjects,
  loadClientStatement,
  partyDisplayName,
  statementPeriodLabel,
} from "@/lib/statements"
import { createClient } from "@/lib/supabase/server"

const note =
  "Amounts owed follow client invoices. Payments reduce the balance on the date they were received."

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const [{ id }, access] = await Promise.all([context.params, getAccess()])
  if (!access || access.status === "deactivated") {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
  }
  if (!allows(access, "clients", "view") || !allows(access, "accounts_receivable", "view")) {
    return NextResponse.json({ error: "You do not have access to this statement." }, { status: 403 })
  }
  if (!access.isOwner && !access.showFinancials) {
    return NextResponse.json({ error: "You do not have access to this statement." }, { status: 403 })
  }
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Unknown client." }, { status: 404 })
  }

  const url = new URL(request.url)
  const format = url.searchParams.get("format")
  if (format !== "pdf" && format !== "xlsx") {
    return NextResponse.json({ error: "Unknown format." }, { status: 400 })
  }

  const supabase = await createClient()
  const [{ data: client }, projects] = await Promise.all([
    supabase.from("clients").select("person_name, company_name").eq("id", id).maybeSingle(),
    getClientProjects(id),
  ])
  if (!client) {
    return NextResponse.json({ error: "Unknown client." }, { status: 404 })
  }

  const launch = await reportLaunchDate()
  const today = officeToday()
  const period = clampPeriod(
    url.searchParams.get("from") ?? "",
    url.searchParams.get("to") ?? "",
    launch,
    today,
  )
  const project = projects.find((item) => item.id === url.searchParams.get("project")) ?? null
  const loaded = await loadClientStatement(id, period.from, period.to, project?.id ?? null)
  if (loaded.status === "missing") {
    return NextResponse.json(
      { error: "Statements are not installed on this database yet." },
      { status: 503 },
    )
  }
  if (loaded.status !== "ok") {
    return NextResponse.json({ error: "Could not calculate this statement." }, { status: 403 })
  }

  const partyName = loaded.statement.party || partyDisplayName(client.person_name, client.company_name, "Client")
  const periodLabel = project
    ? `${statementPeriodLabel(period.from, period.to)} · ${project.name}`
    : statementPeriodLabel(period.from, period.to)
  const report = buildStatementReport({
    title: `Client Statement — ${partyName}`,
    periodLabel,
    debitLabel: "Invoices",
    statement: loaded.statement,
    note,
  })
  const bytes = format === "pdf" ? await buildReportPdf(report) : await buildReportWorkbook(report)
  const filename = `${safeFilename(`client-statement-${partyName}`)}-${period.from}-to-${period.to}.${format === "pdf" ? "pdf" : "xlsx"}`
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type":
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
