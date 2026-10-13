import { NextResponse } from "next/server"

import { buildBackup } from "@/lib/reports/backup"
import { getAccess } from "@/lib/permissions"

export async function GET(request: Request) {
  const access = await getAccess()
  if (!access || access.status === "deactivated") {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 })
  }
  if (!access.isOwner) {
    return NextResponse.json({ error: "Only owners can download a backup." }, { status: 403 })
  }

  const format = new URL(request.url).searchParams.get("format")
  const kind = format === "json" ? "json" : format === "xlsx" ? "excel" : null
  if (!kind) {
    return NextResponse.json({ error: "Choose an Excel or JSON backup." }, { status: 400 })
  }

  const backup = await buildBackup(kind)
  if (backup.status === "missing") {
    return NextResponse.json(
      { error: "Backup logging is not installed yet. Apply the reports migration, then try again." },
      { status: 503 },
    )
  }
  if (backup.status !== "ok") {
    return NextResponse.json({ error: "Could not build the backup." }, { status: 500 })
  }

  return new NextResponse(Buffer.from(backup.bytes), {
    headers: {
      "Content-Type": backup.contentType,
      "Content-Disposition": `attachment; filename="${backup.filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
