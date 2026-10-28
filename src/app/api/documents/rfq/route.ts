import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

import { allows } from "@/lib/access"
import type { PrintMargins } from "@/lib/documents/drafts"
import { collisionNumber, rfqNumber } from "@/lib/documents/numbers"
import { RFQ_BUCKET, rfqFileExpiry, rfqRevision, rfqStoragePath } from "@/lib/documents/rfq-store"
import { renderDocumentPdf } from "@/lib/documents/setc/pdf"
import type { RfqModel } from "@/lib/documents/setc/types"
import { isUuid } from "@/lib/ids"
import { getAccess } from "@/lib/permissions"
import { isIsoDate } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Saves an external RFQ. Nothing is read from business tables and the form body is not stored:
// the server builds the document number, renders the letterhead PDF, uploads it, and keeps
// only the number and the file path. Saving an existing RFQ replaces its file and gives it
// the next revision number.

type Payload = {
  id?: string | null
  issuedOn?: string
  vendorName?: string
  projectName?: string
  source?: { kind?: string; doc?: RfqModel }
  margins?: Partial<PrintMargins>
}

const fail = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(request: Request) {
  const access = await getAccess()
  if (!access || access.status !== "active") return fail("Your session has expired. Sign in again.", 401)

  let payload: Payload
  try {
    payload = (await request.json()) as Payload
  } catch {
    return fail("Could not read the document.")
  }
  if (!payload || typeof payload !== "object") return fail("Could not read the document.")

  const id = typeof payload.id === "string" && payload.id ? payload.id : null
  if (id && !isUuid(id)) return fail("That document could not be found.", 404)
  if (!allows(access, "purchase_orders", id ? "edit" : "add")) return fail("You do not have permission to do that.", 403)

  const issuedOn = String(payload.issuedOn ?? "")
  const vendorName = String(payload.vendorName ?? "").trim()
  const projectName = String(payload.projectName ?? "").trim()
  const doc = payload.source?.kind === "rfq" ? payload.source.doc : undefined
  if (!isIsoDate(issuedOn)) return fail("Enter a date.")
  if (!vendorName) return fail("Enter the vendor name.")
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.lines) || !Array.isArray(doc.facts)) {
    return fail("Could not read the document.")
  }
  if (!doc.lines.some((line) => typeof line?.item === "string" && line.item.trim())) return fail("Add at least one item.")

  const supabase = await createClient()
  let previous: { document_no: string; storage_path: string | null } | null = null
  if (id) {
    const existing = await supabase.from("rfq_documents").select("document_no, storage_path").eq("id", id).maybeSingle()
    if (existing.error || !existing.data) return fail("That document could not be found.", 404)
    previous = existing.data
  }

  const base = rfqNumber(issuedOn, vendorName, projectName)
  const stem = previous ? `${base}-V${rfqRevision(previous.document_no) + 1}` : base
  const documentNo = await freeNumber(supabase, stem, id)
  if (!documentNo) return fail("That document number is already in use.", 409)

  const margins: PrintMargins = {
    topMm: Number(payload.margins?.topMm ?? 16),
    bottomMm: Number(payload.margins?.bottomMm ?? 54),
  }
  let pdf: Uint8Array
  try {
    pdf = await renderDocumentPdf({ kind: "rfq", doc: { ...doc, documentNo, verifyUrl: null } }, margins, true, false)
  } catch {
    return fail("Could not create the PDF.", 500)
  }

  const rfqId = id ?? randomUUID()
  const path = rfqStoragePath(rfqId, randomUUID())
  const upload = await supabase.storage
    .from(RFQ_BUCKET)
    .upload(path, Buffer.from(pdf), { contentType: "application/pdf", upsert: false })
  if (upload.error) return fail("Could not store the RFQ file.", 500)

  const now = new Date()
  const fileFields = {
    document_no: documentNo,
    storage_path: path,
    file_created_at: now.toISOString(),
    file_expires_at: rfqFileExpiry(now),
    updated_at: now.toISOString(),
  }
  const saved = id
    ? await supabase.from("rfq_documents").update(fileFields).eq("id", id).select("id").maybeSingle()
    : await supabase.from("rfq_documents").insert({ id: rfqId, ...fileFields }).select("id").maybeSingle()
  if (saved.error || !saved.data) {
    await supabase.storage.from(RFQ_BUCKET).remove([path])
    if (saved.error?.code === "23505") return fail("That document number is already in use. Save again.", 409)
    if (/42P01|PGRST205|schema cache|does not exist|Could not find the table/i.test(`${saved.error?.code ?? ""} ${saved.error?.message ?? ""}`)) {
      return fail("RFQ storage is not available until the external RFQ migration is applied.", 503)
    }
    return fail("Could not save this document.", 500)
  }
  if (previous?.storage_path && previous.storage_path !== path) {
    await supabase.storage.from(RFQ_BUCKET).remove([previous.storage_path])
  }
  revalidatePath("/documents/rfqs")
  revalidatePath(`/documents/rfqs/${rfqId}`)
  return NextResponse.json({ error: null, id: rfqId, documentNo }, { headers: { "Cache-Control": "no-store" } })
}

async function freeNumber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  stem: string,
  selfId: string | null,
): Promise<string | null> {
  const candidates = Array.from({ length: 8 }, (_, index) => collisionNumber(stem, index + 1))
  const { data, error } = await supabase.from("rfq_documents").select("id, document_no").in("document_no", candidates)
  if (error) return candidates[0] ?? null
  const taken = new Set((data ?? []).filter((row) => row.id !== selfId).map((row) => row.document_no))
  return candidates.find((candidate) => !taken.has(candidate)) ?? null
}
