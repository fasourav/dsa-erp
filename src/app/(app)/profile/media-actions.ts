"use server"

import { revalidatePath } from "next/cache"

import { logActivity } from "@/lib/activity"
import { getAccess } from "@/lib/permissions"
import {
  AVATAR_MAX_BYTES,
  PROFILE_MEDIA_BUCKET,
  SIGNATURE_MAX_BYTES,
  avatarObjectPath,
  signatureObjectPath,
  sniffImage,
} from "@/lib/profile-media"
import { createClient } from "@/lib/supabase/server"

export type MediaResult = { error: string | null }

type Media = "avatar" | "signature"

const rules = {
  avatar: { max: AVATAR_MAX_BYTES, mime: "image/webp", path: avatarObjectPath, label: "profile photo" },
  signature: { max: SIGNATURE_MAX_BYTES, mime: "image/png", path: signatureObjectPath, label: "signature" },
} as const

async function save(media: Media, file: File | null): Promise<MediaResult> {
  const access = await getAccess()
  if (!access || access.status !== "active") return { error: "Your session has expired. Sign in again." }
  const rule = rules[media]
  const supabase = await createClient()
  const path = rule.path(access.userId)
  if (file) {
    if (file.size === 0) return { error: `Choose a ${rule.label} image.` }
    if (file.size > rule.max) return { error: `Use an image under ${rule.max / 1048576} MB.` }
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (sniffImage(bytes) !== rule.mime) return { error: `Could not read that ${rule.label}. Try another image.` }
    const put = await supabase.storage.from(PROFILE_MEDIA_BUCKET).upload(path, bytes, {
      contentType: rule.mime,
      upsert: true,
      cacheControl: "0",
    })
    if (put.error) return { error: `Could not save your ${rule.label}.` }
  } else {
    await supabase.storage.from(PROFILE_MEDIA_BUCKET).remove([path])
  }
  const rpc = await supabase.rpc("set_own_profile_media", { media, next_path: file ? path : null })
  if (rpc.error) return { error: `Could not save your ${rule.label}.` }
  await logActivity({
    module: "users",
    tableName: "profiles",
    recordId: access.userId,
    recordLabel: access.displayName,
    action: "update",
    summary: `${file ? "Updated" : "Removed"} ${rule.label}`,
  })
  if (media === "avatar") {
    // AuthenticatedLayout signs avatarPath for the shell header via getAccountIdentity().
    revalidatePath("/", "layout")
  } else {
    revalidatePath("/profile")
  }
  return { error: null }
}

const fileOf = (formData: FormData) => {
  const file = formData.get("file")
  return file instanceof File ? file : new File([], "empty")
}

export async function uploadAvatar(formData: FormData) {
  return save("avatar", fileOf(formData))
}

export async function removeAvatar() {
  return save("avatar", null)
}

export async function uploadSignature(formData: FormData) {
  return save("signature", fileOf(formData))
}

export async function removeSignature() {
  return save("signature", null)
}
