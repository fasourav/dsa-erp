import { NextResponse } from "next/server"

import { getAccess } from "@/lib/permissions"
import { renderDocumentPdf } from "@/lib/documents/setc/pdf"
import { documentFileName } from "@/lib/documents/setc/render"
import { documentNumberOf, type DocumentModel } from "@/lib/documents/setc/types"
import type { PrintMargins } from "@/lib/documents/drafts"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const kinds = new Set(["print", "challan", "voucher", "certificate", "salary", "letter"])

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
    source?: DocumentModel
    margins?: Partial<PrintMargins>
    letterhead?: boolean
  }
  if (!body.source || !kinds.has(body.source.kind)) {
    return NextResponse.json({ error: "Could not read the document." }, { status: 400 })
  }

  const margins: PrintMargins = {
    topMm: Number(body.margins?.topMm ?? 32),
    bottomMm: Number(body.margins?.bottomMm ?? 28),
  }
  const letterhead = Boolean(body.letterhead)

  try {
    const pdf = await renderDocumentPdf(body.source, margins, letterhead)
    const filename = documentFileName(documentNumberOf(body.source), letterhead)
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Document-Filename": filename,
        "Cache-Control": "no-store",
      },
    })
  } catch {
    return NextResponse.json({ error: "Could not create the PDF." }, { status: 500 })
  }
}
