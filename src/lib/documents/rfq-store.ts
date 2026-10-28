import type { SupabaseClient } from "@supabase/supabase-js"

import { formatIsoDate } from "@/lib/format"
import { isUuid } from "@/lib/ids"
import { createClient } from "@/lib/supabase/server"
import type { DocumentListItem } from "@/lib/documents/queries"

// External RFQ: only the document number and the generated PDF are stored.
// Files are kept for 30 days after they are created, then removed by the daily cron.

export const RFQ_BUCKET = "rfq-files"
export const RFQ_FILE_DAYS = 30

const unavailable = "RFQ storage is not available until the external RFQ migration is applied."

export type RfqRecord = {
  id: string
  documentNo: string
  createdAt: string
  fileCreatedAt: string
  fileExpiresAt: string
  /** False once the file expired or was removed. */
  hasFile: boolean
}

function missingTable(error: { message?: string; code?: string } | null): boolean {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`
  return /42P01|PGRST205|schema cache|does not exist|Could not find the table/i.test(text)
}

function fileAlive(storagePath: string | null, expiresAt: string): boolean {
  return Boolean(storagePath) && Date.parse(expiresAt) > Date.now()
}

/** Revision of an RFQ number: `...-V3` or `...-V3-2` is 3, a number without -V is 1. */
export function rfqRevision(documentNo: string): number {
  const match = /-V(\d+)(?:-\d+)?$/.exec(documentNo.trim())
  const value = match ? Number(match[1]) : 1
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 1
}

export function rfqStoragePath(rfqId: string, fileId: string): string {
  return `${rfqId}/${fileId}.pdf`
}

export function rfqFileExpiry(from: Date): string {
  return new Date(from.getTime() + RFQ_FILE_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export async function listRfqDocuments(): Promise<{ items: DocumentListItem[]; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("rfq_documents")
    .select("id, document_no, created_at, storage_path, file_expires_at")
    .order("created_at", { ascending: false })
  if (error) return { items: [], error: missingTable(error) ? unavailable : "Could not load documents." }
  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: row.document_no,
      detail: [
        formatIsoDate(row.created_at.slice(0, 10)),
        fileAlive(row.storage_path, row.file_expires_at)
          ? `File until ${formatIsoDate(row.file_expires_at.slice(0, 10))}`
          : "File removed",
      ].join(" · "),
      documentNo: row.document_no,
    })),
    error: null,
  }
}

export async function loadRfqDocument(id: string): Promise<{ record: RfqRecord | null; error: string | null }> {
  if (!isUuid(id)) return { record: null, error: "That document could not be found." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("rfq_documents")
    .select("id, document_no, created_at, storage_path, file_created_at, file_expires_at")
    .eq("id", id)
    .maybeSingle()
  if (error) return { record: null, error: missingTable(error) ? unavailable : "Could not load this document." }
  if (!data) return { record: null, error: "That document could not be found." }
  return {
    record: {
      id: data.id,
      documentNo: data.document_no,
      createdAt: data.created_at,
      fileCreatedAt: data.file_created_at,
      fileExpiresAt: data.file_expires_at,
      hasFile: fileAlive(data.storage_path, data.file_expires_at),
    },
    error: null,
  }
}

/**
 * Removes RFQ files older than 30 days. Runs with the service role from the daily cron.
 * The row keeps its document number; only storage_path is cleared.
 */
export async function removeExpiredRfqFiles(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin
    .from("rfq_documents")
    .select("id, storage_path")
    .not("storage_path", "is", null)
    .lte("file_expires_at", new Date().toISOString())
    .limit(500)
  if (error || !data?.length) return 0
  const rows = (data as Array<{ id: string; storage_path: string | null }>).filter(
    (row): row is { id: string; storage_path: string } => Boolean(row.storage_path),
  )
  if (!rows.length) return 0
  const removal = await admin.storage.from(RFQ_BUCKET).remove(rows.map((row) => row.storage_path))
  if (removal.error) return 0
  let cleared = 0
  for (const row of rows) {
    const { error: updateError } = await admin
      .from("rfq_documents")
      .update({ storage_path: null })
      .eq("id", row.id)
      .eq("storage_path", row.storage_path)
    if (!updateError) cleared += 1
  }
  return cleared
}
