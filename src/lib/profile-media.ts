import { createAdminClient } from "@/lib/supabase/admin"

export const PROFILE_MEDIA_BUCKET = "profile-media"
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const SIGNATURE_MAX_BYTES = 1024 * 1024

export const avatarObjectPath = (userId: string) => `avatars/${userId}/circle.webp`
export const signatureObjectPath = (userId: string) => `signatures/${userId}/current.png`

export function sniffImage(bytes: Uint8Array): "image/png" | "image/webp" | "image/jpeg" | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp"
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  return null
}

function bucket() {
  const admin = createAdminClient()
  if (!admin) return null
  return admin.storage.from(PROFILE_MEDIA_BUCKET)
}

export async function signedMediaUrl(path: string | null, seconds = 600) {
  if (!path) return null
  const store = bucket()
  if (!store) return null
  const { data } = await store.createSignedUrl(path, seconds)
  return data?.signedUrl ?? null
}

export async function signedMediaUrls(paths: string[], seconds = 600): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (!unique.length) return {}
  const store = bucket()
  if (!store) return {}
  const { data } = await store.createSignedUrls(unique, seconds)
  const urls: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.path && row.signedUrl) urls[row.path] = row.signedUrl
  }
  return urls
}

export async function mediaDataUrl(path: string) {
  const store = bucket()
  if (!store) return null
  const { data } = await store.download(path)
  if (!data) return null
  const bytes = new Uint8Array(await data.arrayBuffer())
  const mime = sniffImage(bytes)
  return mime ? `data:${mime};base64,${Buffer.from(bytes).toString("base64")}` : null
}
