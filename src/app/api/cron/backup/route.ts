import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { isBackupEmailEnabled, runDailyBackup } from "@/lib/reports/daily-backup"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 })
  }
  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json({ error: "The service role key is not configured." }, { status: 503 })
  }

  const result = await runDailyBackup(admin)
  return NextResponse.json(
    {
      status: result.status,
      sizeBytes: result.sizeBytes,
      storagePath: result.storagePath,
      emailed: false,
      emailEnabled: isBackupEmailEnabled(),
      error: result.error,
    },
    {
      status: result.status === "ok" ? 200 : 500,
      headers: { "Cache-Control": "no-store" },
    },
  )
}
