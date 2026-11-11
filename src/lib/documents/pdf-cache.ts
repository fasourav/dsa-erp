import { createHash } from "node:crypto"

import type { SupabaseClient } from "@supabase/supabase-js"
import { after } from "next/server"

import { createAdminClient } from "@/lib/supabase/admin"

export const PDF_CACHE_BUCKET = "document-pdfs"
export const PDF_CACHE_VERSION = "1" // bump when pdf.ts post-processing or this file's format changes
// Must change whenever @sparticuz/chromium is upgraded in package.json.
export const PDF_RENDERER_ID = "sparticuz-chromium-153.0.0" // keep in step with package.json @sparticuz/chromium
export const PDF_CACHE_DAYS = 30
export const PDF_CACHE_KEEP_PER_DOCUMENT = 3 // per record (kind + id), both modes together
const MAX_BYTES = 10 * 1024 * 1024

export type PdfMode = "letterhead" | "print"

let unavailableUntil = 0

function markUnavailable(): void {
  unavailableUntil = Date.now() + 10 * 60_000
}

function missingTable(error: { message?: string; code?: string } | null): boolean {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`
  return /42P01|PGRST205|schema cache|does not exist|Could not find the table/i.test(text)
}

function missingBucket(error: { message?: string } | null): boolean {
  return /bucket not found/i.test(error?.message ?? "")
}

function duplicateError(
  error: { message?: string; code?: string; statusCode?: string | number; error?: string } | null,
): boolean {
  if (!error) return false
  const text = `${error.code ?? ""} ${error.statusCode ?? ""} ${error.error ?? ""} ${error.message ?? ""}`
  return /23505|409|duplicate|already exists/i.test(text)
}

function startsWithPdfHeader(bytes: Uint8Array): boolean {
  return (
    bytes.byteLength >= 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d // -
  )
}

export function pdfCacheEnabled(): boolean {
  try {
    if (process.env.PDF_CACHE?.trim().toLowerCase() === "off") return false
    if (unavailableUntil > Date.now()) return false
    if (!createAdminClient()) return false
    return true
  } catch {
    return false
  }
}

export function pdfCacheKey(input: { kind: string; id: string; mode: PdfMode; html: string }): string {
  return createHash("sha256")
    .update([PDF_CACHE_VERSION, PDF_RENDERER_ID, input.kind, input.id, input.mode].join("\n"))
    .update("\n")
    .update(input.html) // FINAL html from prepareDocumentHtml: signatures + letterhead already inlined
    .digest("hex")
}

export const pdfCachePath = (kind: string, id: string, mode: PdfMode, key: string) =>
  `${kind}/${id}/${mode}-${key}.pdf`

export async function readCachedPdf({
  kind,
  id,
  mode,
  key,
}: {
  kind: string
  id: string
  mode: PdfMode
  key: string
}): Promise<Uint8Array | null> {
  try {
    if (!pdfCacheEnabled()) return null
    const admin = createAdminClient()
    if (!admin) return null

    const { data, error } = await admin
      .from("document_pdf_cache")
      .select("storage_path")
      .eq("cache_key", key)
      .eq("record_kind", kind)
      .eq("record_id", id)
      .eq("letterhead", mode === "letterhead")
      .maybeSingle()

    if (error) {
      if (missingTable(error)) markUnavailable()
      return null
    }
    if (!data?.storage_path) return null

    const storagePath = data.storage_path
    const downloaded = await admin.storage.from(PDF_CACHE_BUCKET).download(storagePath)
    if (downloaded.error || !downloaded.data) {
      if (missingBucket(downloaded.error)) {
        markUnavailable()
        return null
      }
      scheduleCorruptCleanup(key, storagePath)
      return null
    }

    const bytes = new Uint8Array(await downloaded.data.arrayBuffer())
    if (!startsWithPdfHeader(bytes)) {
      scheduleCorruptCleanup(key, storagePath)
      return null
    }

    return bytes
  } catch {
    return null
  }
}

function scheduleCorruptCleanup(key: string, storagePath: string): void {
  try {
    after(async () => {
      try {
        const admin = createAdminClient()
        if (!admin) return
        await admin.storage.from(PDF_CACHE_BUCKET).remove([storagePath])
        await admin.from("document_pdf_cache").delete().eq("cache_key", key)
      } catch {
        // Ignore cleanup errors.
      }
    })
  } catch {
    // Ignore if after() is unavailable.
  }
}

export function storeCachedPdfLater({
  kind,
  id,
  mode,
  key,
  bytes,
}: {
  kind: string
  id: string
  mode: PdfMode
  key: string
  bytes: Uint8Array
}): void {
  try {
    if (bytes.byteLength <= 0 || bytes.byteLength > MAX_BYTES) return
    const copy = new Uint8Array(bytes)
    after(async () => {
      try {
        if (!pdfCacheEnabled()) return
        const admin = createAdminClient()
        if (!admin) return

        const storagePath = pdfCachePath(kind, id, mode, key)
        const upload = await admin.storage.from(PDF_CACHE_BUCKET).upload(storagePath, copy, {
          contentType: "application/pdf",
          upsert: false,
          cacheControl: "0",
        })

        if (upload.error) {
          if (missingBucket(upload.error)) {
            markUnavailable()
            return
          }
          if (!duplicateError(upload.error)) {
            return
          }
        }

        const inserted = await admin.from("document_pdf_cache").upsert(
          {
            record_kind: kind,
            record_id: id,
            letterhead: mode === "letterhead",
            cache_key: key,
            storage_path: storagePath,
            size_bytes: copy.byteLength,
          },
          { onConflict: "cache_key", ignoreDuplicates: true },
        )

        if (inserted.error && !duplicateError(inserted.error)) {
          if (missingTable(inserted.error)) markUnavailable()
          await admin.storage.from(PDF_CACHE_BUCKET).remove([storagePath])
          return
        }

        const { data: stale } = await admin
          .from("document_pdf_cache")
          .select("id, storage_path")
          .eq("record_kind", kind)
          .eq("record_id", id)
          .order("created_at", { ascending: false })
          .range(PDF_CACHE_KEEP_PER_DOCUMENT, 99)

        if (stale && stale.length > 0) {
          const oldRows = stale as Array<{ id: string; storage_path: string }>
          const paths = oldRows.map((row) => row.storage_path).filter(Boolean)
          if (paths.length > 0) {
            await admin.storage.from(PDF_CACHE_BUCKET).remove(paths)
          }
          await admin
            .from("document_pdf_cache")
            .delete()
            .in(
              "id",
              oldRows.map((row) => row.id),
            )
        }
      } catch {
        // Cache storage must never throw.
      }
    })
  } catch {
    // Cache scheduling must never throw.
  }
}

export async function removeExpiredPdfCache(admin: SupabaseClient): Promise<number> {
  const cutoff = new Date(Date.now() - PDF_CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from("document_pdf_cache")
    .select("id, storage_path")
    .lte("created_at", cutoff)
    .limit(500)
  if (error) {
    if (missingTable(error)) markUnavailable()
    return 0
  }
  if (!data?.length) return 0
  const rows = (data as Array<{ id: string; storage_path: string | null }>).filter(
    (row): row is { id: string; storage_path: string } => Boolean(row.storage_path),
  )
  if (!rows.length) return 0
  const removal = await admin.storage.from(PDF_CACHE_BUCKET).remove(rows.map((row) => row.storage_path))
  if (removal.error) {
    if (missingBucket(removal.error)) markUnavailable()
    return 0
  }
  const { error: deleteError } = await admin
    .from("document_pdf_cache")
    .delete()
    .in(
      "id",
      rows.map((row) => row.id),
    )
  if (deleteError) return 0
  return rows.length
}
