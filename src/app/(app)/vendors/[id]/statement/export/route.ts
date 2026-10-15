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
  loadVendorStatement,
  partyDisplayName,
  statementPeriodLabel,
} from "@/lib/statements"
import { createClient } from "@/lib/supabase/server"

const note =
  "Amounts owed follow vendor bills. A purchase order is shown only as the bill reference and is not an amount owed."

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const [{ id }, access] = await Promise.all([context.params, getAccess()])
  if (!access || access.status === "deactivated") {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
  }
  if (!allows(access, "vendors", "view") || !allows(access, "accounts_payable", "view")) {
    return NextResponse.json({ error: "You do not have access to this statement." }, { status: 403 })
  }
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Unknown vendor." }, { status: 404 })
  }

  const url = new URL(request.url)
  const format = url.searchParams.get("format")
  if (format !== "pdf" && format !== "xlsx") {
    return NextResponse.json({ error: "Unknown format." }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: vendor } = await supabase
    .from("vendors")
    .select("person_name, company_name")
    .eq("id", id)
    .maybeSingle()
  if (!vendor) {
    return NextResponse.json({ error: "Unknown vendor." }, { status: 404 })
  }

  const launch = await reportLaunchDate()
  const today = officeToday()
  const period = clampPeriod(
    url.searchParams.get("from") ?? "",
    url.searchParams.get("to") ?? "",
    launch,
    today,
  )
  const loaded = await loadVendorStatement(id, period.from, period.to)
  if (loaded.status === "missing") {
    return NextResponse.json(
      { error: "Statements are not installed on this database yet." },
      { status: 503 },
    )
  }
  if (loaded.status !== "ok") {
    return NextResponse.json({ error: "Could not calculate this statement." }, { status: 403 })
  }

  const partyName = loaded.statement.party || partyDisplayName(vendor.person_name, vendor.company_name, "Vendor")
  const report = buildStatementReport({
    title: `Vendor Statement — ${partyName}`,
    periodLabel: statementPeriodLabel(period.from, period.to),
    debitLabel: "Bills",
    statement: loaded.statement,
    note,
  })
  const bytes = format === "pdf" ? await buildReportPdf(report) : await buildReportWorkbook(report)
  const filename = `${safeFilename(`vendor-statement-${partyName}`)}-${period.from}-to-${period.to}.${format === "pdf" ? "pdf" : "xlsx"}`
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
