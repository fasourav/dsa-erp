// DEPRECATED in v1.3.2: Excel lists are built in the browser. This route is only a fallback when the browser build fails. Remove in v1.3.3.
import { NextResponse } from "next/server"

import { buildListWorkbook, parseListGrid } from "@/lib/reports/workbook"
import { getAccess } from "@/lib/permissions"

export async function POST(request: Request) {
  const access = await getAccess()
  if (!access || access.status === "deactivated") {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Could not read this export." }, { status: 400 })
  }

  const grid = parseListGrid(body)
  if (!grid) {
    return NextResponse.json({ error: "Could not read this export." }, { status: 400 })
  }

  const bytes = await buildListWorkbook(grid)
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${grid.filename}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
