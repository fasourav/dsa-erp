import { NextResponse } from "next/server"

import { formatBackupWhen } from "@/app/(app)/settings/queries"
import { logActivity } from "@/lib/activity"
import { isUuid } from "@/lib/ids"
import { denyUnlessOwner } from "@/lib/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

const BACKUP_BUCKET = "backups"
const DOWNLOAD_ERROR = "Could not download this backup."

export async function GET(request: Request) {
  const denied = await denyUnlessOwner()
  if (denied) {
    const status = denied.startsWith("Your session") ? 401 : 403
    return NextResponse.json({ error: denied }, { status })
  }

  const id = new URL(request.url).searchParams.get("id")?.trim() ?? ""
  if (!isUuid(id)) {
    return NextResponse.json({ error: DOWNLOAD_ERROR }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: run, error: runError } = await supabase
    .from("backup_runs")
    .select("id, ran_at, storage_path")
    .eq("id", id)
    .maybeSingle()

  const storagePath = run?.storage_path?.trim() ?? ""
  if (
    runError ||
    !run ||
    !storagePath ||
    !storagePath.startsWith("daily/") ||
    storagePath.includes("..")
  ) {
    return NextResponse.json({ error: DOWNLOAD_ERROR }, { status: 404 })
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: DOWNLOAD_ERROR }, { status: 500 })
  }

  const signed = await admin.storage.from(BACKUP_BUCKET).createSignedUrl(storagePath, 60)
  if (signed.error || !signed.data?.signedUrl) {
    return NextResponse.json({ error: DOWNLOAD_ERROR }, { status: 500 })
  }

  let bytes: ArrayBuffer
  try {
    const fileResponse = await fetch(signed.data.signedUrl, { cache: "no-store" })
    if (!fileResponse.ok) {
      return NextResponse.json({ error: DOWNLOAD_ERROR }, { status: 500 })
    }
    bytes = await fileResponse.arrayBuffer()
  } catch {
    return NextResponse.json({ error: DOWNLOAD_ERROR }, { status: 500 })
  }

  const dhakaLabel = formatBackupWhen(run.ran_at)
  await logActivity({
    module: "settings",
    tableName: "backup",
    recordId: run.id,
    recordLabel: dhakaLabel === "—" ? "Saved backup" : dhakaLabel,
    action: "export",
    summary: "Downloaded a saved backup",
  })

  const filename = formatBackupFilename(run.ran_at)
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  })
}

function formatBackupFilename(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "dsa-erp-backup.zip"

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""

  const year = get("year")
  const month = get("month")
  const day = get("day")
  const rawHour = get("hour")
  const hour = rawHour === "24" ? "00" : rawHour
  const minute = get("minute")

  if (!year || !month || !day || !hour || !minute) {
    return "dsa-erp-backup.zip"
  }

  return `dsa-erp-backup-${year}-${month}-${day}-${hour}${minute}.zip`
}
