"use server"

import { revalidatePath } from "next/cache"

import type { ModuleKey } from "@/lib/access"
import { denyUnless } from "@/lib/permissions"
import { isUuid } from "@/lib/ids"
import {
  ATTACHMENT_BYTE_LIMIT,
  attachmentExtension,
  attachmentModule,
  isAttachmentParent,
  safeFileLabel,
  matchesAttachmentSignature,
  type AttachmentParent,
} from "@/lib/attachments"
import { createClient } from "@/lib/supabase/server"
import { removeQueuedAttachmentFiles } from "@/lib/attachment-files"

export type AttachmentRow = {
  id: string
  fileName: string
  contentType: string
  byteSize: number
  createdAt: string
}

const bucket = "attachments"

export async function listAttachments(
  parentType: string,
  parentId: string,
): Promise<{ rows: AttachmentRow[]; error: string | null }> {
  if (!isAttachmentParent(parentType) || !isUuid(parentId)) {
    return { rows: [], error: "That record could not be found." }
  }
  const denied = await denyAttachment(parentType, parentId, "view")
  if (denied) return { rows: [], error: denied }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("record_attachments")
    .select("id, file_name, content_type, byte_size, created_at")
    .eq("parent_type", parentType)
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false })

  if (error) return { rows: [], error: "Could not load files." }
  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      fileName: row.file_name,
      contentType: row.content_type,
      byteSize: row.byte_size,
      createdAt: row.created_at,
    })),
    error: null,
  }
}

export async function uploadAttachment(
  formData: FormData,
): Promise<{ error: string | null }> {
  const parentType = String(formData.get("parentType") ?? "")
  const parentId = String(formData.get("parentId") ?? "")
  const file = formData.get("file")
  if (!isAttachmentParent(parentType) || !isUuid(parentId)) {
    return { error: "That record could not be found." }
  }
  if (!(file instanceof File) || file.size <= 0) {
    return { error: "Choose a file to upload." }
  }
  if (file.size > ATTACHMENT_BYTE_LIMIT) {
    return { error: "Files must be 10 MB or smaller." }
  }
  const contentType = mimeOf(file)
  const extension = contentType ? attachmentExtension(contentType) : null
  if (!contentType || !extension) {
    return { error: "Use a PDF, JPG, PNG, WEBP, XLSX, or DOCX file." }
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!matchesAttachmentSignature(contentType, bytes)) {
    return { error: "This file's contents don't match its type. Use a real PDF, JPG, PNG, WEBP, XLSX, or DOCX file." }
  }

  const denied = await denyAttachment(parentType, parentId, "edit")
  if (denied) return { error: denied }

  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) return { error: "You must be signed in." }

  const id = crypto.randomUUID()
  const storagePath = `${parentType}/${parentId}/${id}/${id}.${extension}`
  const { error: insertError } = await supabase.from("record_attachments").insert({
    id,
    parent_type: parentType,
    parent_id: parentId,
    file_name: safeFileLabel(file.name),
    content_type: contentType,
    byte_size: file.size,
    storage_path: storagePath,
    created_by: auth.user.id,
  })
  if (insertError) return { error: "Could not save this file." }

  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, bytes, {
    contentType,
    upsert: false,
  })
  if (uploadError) {
    await supabase.from("record_attachments").delete().eq("id", id)
    return { error: "Could not upload this file." }
  }

  revalidatePath("/", "layout")
  return { error: null }
}

export async function attachmentSignedUrl(
  id: string,
): Promise<{ url: string | null; contentType: string | null; fileName: string | null; error: string | null }> {
  if (!isUuid(id)) return { url: null, contentType: null, fileName: null, error: "That file could not be found." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("record_attachments")
    .select("id, storage_path, content_type, file_name, parent_type, parent_id")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) {
    return { url: null, contentType: null, fileName: null, error: "That file could not be found." }
  }
  const denied = await denyAttachment(data.parent_type, data.parent_id, "view")
  if (denied) return { url: null, contentType: null, fileName: null, error: denied }

  const signed = await supabase.storage.from(bucket).createSignedUrl(data.storage_path, 120)
  if (signed.error || !signed.data?.signedUrl) {
    return { url: null, contentType: null, fileName: null, error: "Could not open this file." }
  }
  return {
    url: signed.data.signedUrl,
    contentType: data.content_type,
    fileName: data.file_name,
    error: null,
  }
}

export async function deleteAttachment(id: string): Promise<{ error: string | null }> {
  if (!isUuid(id)) return { error: "That file could not be found." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("record_attachments")
    .select("id, storage_path, parent_type, parent_id")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return { error: "That file could not be found." }
  const denied = await denyAttachment(data.parent_type, data.parent_id, "delete")
  if (denied) return { error: denied }

  const { error: deleteError } = await supabase.from("record_attachments").delete().eq("id", id)
  if (deleteError) return { error: "Could not delete this file." }
  await supabase.storage.from(bucket).remove([data.storage_path])
  await removeQueuedAttachmentFiles(supabase)
  revalidatePath("/", "layout")
  return { error: null }
}

async function denyAttachment(
  parentType: string,
  parentId: string,
  action: "view" | "edit" | "delete",
): Promise<string | null> {
  if (!isAttachmentParent(parentType)) return "That record could not be found."
  const moduleName = await moduleFor(parentType, parentId)
  if (!moduleName) return "That record could not be found."
  return denyUnless(moduleName, action)
}

async function moduleFor(
  parentType: AttachmentParent,
  parentId: string,
): Promise<ModuleKey | null> {
  const direct = attachmentModule(parentType)
  if (direct) return direct
  const supabase = await createClient()
  const { data } = await supabase
    .from("issued_documents")
    .select("kind")
    .eq("id", parentId)
    .maybeSingle()
  if (!data) return null
  if (data.kind === "purchase_order") return "purchase_orders"
  if (data.kind === "invoice" || data.kind === "receipt") return "client_invoices"
  return null
}

function mimeOf(file: File): string | null {
  const type = file.type === "image/jpg" ? "image/jpeg" : file.type
  if (attachmentExtension(type)) return type
  const extension = file.name.split(".").pop()?.toLowerCase()
  const byExtension: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }
  return extension ? byExtension[extension] ?? null : null
}
