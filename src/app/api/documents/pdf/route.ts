import { NextResponse } from "next/server"

import { allows } from "@/lib/access"
import { getAccess } from "@/lib/permissions"
import type { PrintMargins } from "@/lib/documents/drafts"
import { RFQ_BUCKET } from "@/lib/documents/rfq-store"
import { renderDocumentPdf } from "@/lib/documents/setc/pdf"
import { documentFileName } from "@/lib/documents/setc/render"
import { loadSavedDocument } from "@/lib/documents/setc/saved"
import { documentNumberOf, savedRecordKinds, type DocumentModel, type SavedRecordKind } from "@/lib/documents/setc/types"
import { isUuid } from "@/lib/ids"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const draftKinds = new Set(["print", "challan", "voucher", "certificate", "salary", "letter", "rfq"])

function isSavedKind(value: string): value is SavedRecordKind {
  return (savedRecordKinds as readonly string[]).includes(value)
}

export async function POST(request: Request) {
  const access = await getAccess()
  if (!access || access.status !== "active") {
    return NextResponse.json({ error: "Sign in to download a document." }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Could not read the document." }, { status: 400 })
  }
  if (!payload || typeof payload !== "object") {
    return NextResponse.json({ error: "Could not read the document." }, { status: 400 })
  }

  const body = payload as {
    recordKind?: string
    id?: string
    source?: DocumentModel
    margins?: Partial<PrintMargins>
    letterhead?: boolean
    draft?: boolean
  }
  const letterhead = Boolean(body.letterhead)

  try {
    if (body.recordKind && body.id) {
      if (!isSavedKind(body.recordKind) || !isUuid(body.id)) {
        return NextResponse.json({ error: "That document could not be found." }, { status: 404 })
      }
      if (body.recordKind === "rfq") {
        if (!allows(access, "purchase_orders", "view")) {
          return NextResponse.json({ error: "You do not have permission to download this document." }, { status: 403 })
        }
        return await savedRfqPdfResponse(body.id)
      }
      const loaded = await loadSavedDocument(body.recordKind, body.id)
      if ("error" in loaded) {
        return NextResponse.json({ error: loaded.error }, { status: loaded.status })
      }
      const pdf = await renderDocumentPdf(loaded.model, loaded.margins, letterhead, false)
      const filename = documentFileName(loaded.filenameNo, letterhead)
      return pdfResponse(pdf, filename)
    }

    if (!body.draft || !body.source || !draftKinds.has(body.source.kind)) {
      return NextResponse.json({ error: "Save the document before downloading it." }, { status: 400 })
    }
    const margins: PrintMargins = {
      topMm: Number(body.margins?.topMm ?? 16),
      bottomMm: Number(body.margins?.bottomMm ?? 54),
    }
    const pdf = await renderDocumentPdf(body.source, margins, letterhead, true)
    const filename = documentFileName(documentNumberOf(body.source), letterhead)
    return pdfResponse(pdf, filename)
  } catch {
    return NextResponse.json({ error: "Could not create the PDF." }, { status: 500 })
  }
}

async function savedRfqPdfResponse(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("rfq_documents")
    .select("document_no, storage_path, file_expires_at")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) {
    return NextResponse.json({ error: "That document could not be found." }, { status: 404 })
  }
  if (!data.storage_path || Date.parse(data.file_expires_at) <= Date.now()) {
    return NextResponse.json({ error: "This RFQ file was automatically removed after 30 days." }, { status: 404 })
  }
  const downloaded = await supabase.storage.from(RFQ_BUCKET).download(data.storage_path)
  if (downloaded.error || !downloaded.data) {
    return NextResponse.json({ error: "Could not load the saved RFQ file." }, { status: 404 })
  }
  const pdf = new Uint8Array(await downloaded.data.arrayBuffer())
  return pdfResponse(pdf, documentFileName(data.document_no, true))
}

function pdfResponse(pdf: Uint8Array, filename: string) {
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Document-Filename": filename,
      "Cache-Control": "no-store",
    },
  })
}
