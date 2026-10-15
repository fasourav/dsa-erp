import { timingSafeEqual } from "node:crypto"

import { NextResponse } from "next/server"

import { removeQueuedAttachmentFiles } from "@/lib/attachment-files"
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

  const sweep = await admin.rpc("sweep_orphan_attachments")
  if (sweep.error) {
    return NextResponse.json({ error: "Could not sweep attachments." }, { status: 500 })
  }
  const removed = await removeQueuedAttachmentFiles(admin)
  // 90-day backstop for QR verify rate-limit hits; failure here never blocks the sweep.
  await admin.rpc("purge_document_verify_hits")
  return NextResponse.json({ queued: sweep.data ?? 0, removed }, { headers: { "Cache-Control": "no-store" } })
}
