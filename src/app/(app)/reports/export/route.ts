import { NextResponse } from "next/server"

import { canSeeReport } from "@/lib/access"
import { loadProjectBudgetReport } from "@/lib/project-budget"
import { isReportSlug, reportBySlug } from "@/lib/reports/catalog"
import { loadFinancialReport, reportLaunchDate } from "@/lib/reports/load"
import { buildReportPdf } from "@/lib/reports/pdf"
import { clampPeriod, officeToday } from "@/lib/reports/period"
import { buildProjectBudgetReport, buildReport } from "@/lib/reports/tables"
import { buildReportWorkbook, safeFilename } from "@/lib/reports/workbook"
import { getAccess } from "@/lib/permissions"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const slug = url.searchParams.get("report") ?? ""
  const format = url.searchParams.get("format")
  if (!isReportSlug(slug) || (format !== "pdf" && format !== "xlsx")) {
    return NextResponse.json({ error: "Unknown report." }, { status: 400 })
  }

  const access = await getAccess()
  if (!access || access.status === "deactivated") {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
  }
  if (!canSeeReport(access, slug)) {
    return NextResponse.json({ error: "You do not have access to this report." }, { status: 403 })
  }

  if (slug === "project-budget") {
    const loaded = await loadProjectBudgetReport()
    if (loaded.status === "missing") {
      return NextResponse.json(
        { error: "Project budgets are not installed on this database yet." },
        { status: 503 },
      )
    }
    if (loaded.status !== "ok") {
      return NextResponse.json({ error: "Could not calculate this report." }, { status: 403 })
    }
    const built = buildProjectBudgetReport(reportBySlug(slug).title, loaded.lines)
    const bytes = format === "pdf" ? await buildReportPdf(built) : await buildReportWorkbook(built)
    const filename = `${safeFilename(slug)}.${format === "pdf" ? "pdf" : "xlsx"}`
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

  const launch = await reportLaunchDate()
  const today = officeToday()
  const period = clampPeriod(
    url.searchParams.get("from") ?? "",
    url.searchParams.get("to") ?? "",
    launch,
    today,
  )
  const loaded = await loadFinancialReport(period.from, period.to)
  if (loaded.status === "missing") {
    return NextResponse.json(
      { error: "Financial reports are not installed on this database yet." },
      { status: 503 },
    )
  }
  if (loaded.status !== "ok") {
    return NextResponse.json({ error: "Could not calculate this report." }, { status: 403 })
  }

  const built = buildReport(slug, reportBySlug(slug).title, loaded.report)
  if (!built) {
    return NextResponse.json({ error: "You do not have access to this report." }, { status: 403 })
  }

  const bytes = format === "pdf" ? await buildReportPdf(built) : await buildReportWorkbook(built)
  const filename = `${safeFilename(slug)}-${period.from}-to-${period.to}.${format === "pdf" ? "pdf" : "xlsx"}`
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
