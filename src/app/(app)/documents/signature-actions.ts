"use server"

import { revalidatePath } from "next/cache"

import { allows } from "@/lib/access"
import { logActivity } from "@/lib/activity"
import { SIGNATURE_OFF } from "@/lib/documents/drafts"
import { recordTarget } from "@/lib/documents/signature-loader"
import {
  canClearStamp,
  canStampSlot,
  isStampKind,
  isStampSlot,
  parseStamps,
  slotLabel,
  stampObjectPath,
  type SignatureStamps,
  type StampKind,
  type StampSlot,
} from "@/lib/documents/signature-stamps"
import { isUuid } from "@/lib/ids"
import { getAccess } from "@/lib/permissions"
import { PROFILE_MEDIA_BUCKET, signedMediaUrl } from "@/lib/profile-media"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database.types"

export type StampResult =
  | { error: string }
  | { error: null; stamps: SignatureStamps; name: string; imageUrl: string | null }

type Input = { kind: StampKind; id: string; slot: StampSlot }

const columnOf = { prepared: "prepared_by", checked: "checked_by", authorized: "authorized_by" } as const
const bodyKey = { prepared: "preparedBy", checked: "checkedBy", authorized: "authorizedBy" } as const

type Loaded = {
  access: NonNullable<Awaited<ReturnType<typeof getAccess>>>
  target: ReturnType<typeof recordTarget>
  supabase: Awaited<ReturnType<typeof createClient>>
  body: Record<string, Json | undefined>
  rowId: string
  documentNo: string
  stamps: SignatureStamps
  currentName: string
}

async function gate(input: Input): Promise<Loaded | { error: string }> {
  if (!isStampKind(input.kind) || !isStampSlot(input.slot) || !isUuid(input.id)) {
    return { error: "That document could not be found." }
  }
  const access = await getAccess()
  if (!access || access.status !== "active") return { error: "Your session has expired. Sign in again." }
  const target = recordTarget(input.kind)
  if (!allows(access, target.module, "edit")) return { error: "You do not have permission to do that." }

  const supabase = await createClient()
  const row = await loadRow(supabase, input)
  if (!row) return { error: "Save the document before signing it." }

  const body = (row.body && typeof row.body === "object" && !Array.isArray(row.body) ? row.body : {}) as Record<
    string,
    Json | undefined
  >
  const named = row as { prepared_by?: string; checked_by?: string; authorized_by?: string }
  const raw = target.names === "column" ? named[columnOf[input.slot]] : body[bodyKey[input.slot]]
  return {
    access,
    target,
    supabase,
    body,
    rowId: row.id,
    documentNo: row.document_no ?? "",
    stamps: parseStamps(row.signature_stamps),
    currentName: typeof raw === "string" ? raw : "",
  }
}

async function loadRow(supabase: Awaited<ReturnType<typeof createClient>>, input: Input) {
  if (input.kind === "quotation") {
    const { data } = await supabase
      .from("quotations")
      .select("id, document_no, signature_stamps, prepared_by, checked_by, authorized_by")
      .eq("id", input.id)
      .is("deleted_at", null)
      .maybeSingle()
    return data ? { ...data, body: null } : null
  }
  if (input.kind === "work_order") {
    const { data } = await supabase
      .from("work_orders")
      .select("id, document_no, signature_stamps, prepared_by, checked_by, authorized_by")
      .eq("id", input.id)
      .is("deleted_at", null)
      .maybeSingle()
    return data ? { ...data, body: null } : null
  }
  const key =
    input.kind === "invoice" ? "client_invoice_id" : input.kind === "receipt" ? "client_payment_id" : "purchase_order_id"
  const { data } = await supabase
    .from("issued_documents")
    .select("id, document_no, signature_stamps, body")
    .eq(key, input.id)
    .eq("kind", input.kind)
    .is("deleted_at", null)
    .maybeSingle()
  return data
}

async function writeStamps(
  loaded: Loaded,
  input: Input,
  stamps: SignatureStamps,
  name?: string,
) {
  const signature_stamps = stamps as unknown as Json
  if (loaded.target.table === "quotations") {
    const patch: { signature_stamps: Json; prepared_by?: string; checked_by?: string; authorized_by?: string } = {
      signature_stamps,
    }
    if (name !== undefined) patch[columnOf[input.slot]] = name
    return loaded.supabase.from("quotations").update(patch).eq("id", loaded.rowId)
  }
  if (loaded.target.table === "work_orders") {
    const patch: { signature_stamps: Json; prepared_by?: string; checked_by?: string; authorized_by?: string } = {
      signature_stamps,
    }
    if (name !== undefined) patch[columnOf[input.slot]] = name
    return loaded.supabase.from("work_orders").update(patch).eq("id", loaded.rowId)
  }
  const patch: { signature_stamps: Json; body?: Json } = { signature_stamps }
  if (name !== undefined) patch.body = { ...loaded.body, [bodyKey[input.slot]]: name }
  return loaded.supabase.from("issued_documents").update(patch).eq("id", loaded.rowId)
}

export async function stampSignature(input: Input): Promise<StampResult> {
  const loaded = await gate(input)
  if ("error" in loaded) return { error: loaded.error }
  const { access } = loaded
  if (!canStampSlot(access.role, input.slot)) return { error: `Your role cannot sign ${slotLabel[input.slot]}.` }
  if (!access.signaturePath) return { error: "Upload your signature on My Profile first." }
  if (loaded.currentName === SIGNATURE_OFF) return { error: `Turn on ${slotLabel[input.slot]} first.` }

  const admin = createAdminClient()
  if (!admin) return { error: "Could not place your signature." }
  const store = admin.storage.from(PROFILE_MEDIA_BUCKET)
  const dest = stampObjectPath(input.kind, input.id, input.slot)
  const src = await store.download(access.signaturePath)
  if (!src.data) return { error: "Could not read your signature. Upload it again on My Profile." }
  const put = await store.upload(dest, await src.data.arrayBuffer(), {
    contentType: "image/png",
    upsert: true,
    cacheControl: "0",
  })
  if (put.error) return { error: "Could not place your signature." }

  const name = access.displayName
  const stamps: SignatureStamps = {
    ...loaded.stamps,
    [input.slot]: {
      imagePath: dest,
      name,
      designation: access.designation ?? "",
      signedByUserId: access.userId,
      signedAt: new Date().toISOString(),
    },
  }
  const { error } = await writeStamps(loaded, input, stamps, name)
  if (error) return { error: "Could not place your signature." }
  await logActivity({
    module: "documents",
    tableName: loaded.target.table,
    recordId: loaded.rowId,
    recordLabel: loaded.documentNo,
    action: "update",
    summary: `Signed ${slotLabel[input.slot]}`,
    newValues: { slot: input.slot, signer: name },
  })
  revalidatePath(loaded.target.page(input.id))
  return { error: null, stamps, name, imageUrl: await signedMediaUrl(dest) }
}

export async function clearSignature(input: Input): Promise<StampResult> {
  const loaded = await gate(input)
  if ("error" in loaded) return { error: loaded.error }
  const stamp = loaded.stamps[input.slot]
  if (
    !canClearStamp({
      role: loaded.access.role,
      isOwner: loaded.access.isOwner,
      userId: loaded.access.userId,
      stamp,
    })
  ) {
    return { error: "Only the signer or an owner can clear this signature." }
  }
  const stamps: SignatureStamps = { ...loaded.stamps }
  delete stamps[input.slot]
  const { error } = await writeStamps(loaded, input, stamps)
  if (error) return { error: "Could not clear the signature." }
  const admin = createAdminClient()
  if (admin) {
    await admin.storage.from(PROFILE_MEDIA_BUCKET).remove([stampObjectPath(input.kind, input.id, input.slot)])
  }
  await logActivity({
    module: "documents",
    tableName: loaded.target.table,
    recordId: loaded.rowId,
    recordLabel: loaded.documentNo,
    action: "update",
    summary: `Cleared ${slotLabel[input.slot]} signature`,
    newValues: { slot: input.slot },
  })
  revalidatePath(loaded.target.page(input.id))
  return { error: null, stamps, name: loaded.currentName, imageUrl: null }
}
