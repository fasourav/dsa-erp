"use server"

import { revalidatePath } from "next/cache"

import { getAccess } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

export type ProfileState = {
  error?: string
  saved?: boolean
}

function cleanName(value: string): { error: string } | { name: string } {
  const name = value.replace(/\s+/g, " ").trim()
  if (!name) return { error: "Enter a full name." }
  if (name.length > 120) return { error: "Use a shorter name." }
  return { name }
}

export async function updateDisplayName(
  _state: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const cleaned = cleanName(String(formData.get("displayName") ?? ""))
  if ("error" in cleaned) return { error: cleaned.error }

  const supabase = await createClient()
  const rpc = await supabase.rpc("set_own_display_name", { next_name: cleaned.name })

  if (rpc.error && /set_own_display_name|schema cache|PGRST202|function/i.test(rpc.error.message)) {
    const access = await getAccess()
    if (!access?.isOwner) return { error: "Could not save your name." }
    const fallback = await supabase
      .from("profiles")
      .update({ display_name: cleaned.name })
      .eq("id", access.userId)
      .select("id")
    if (fallback.error || !fallback.data?.length) return { error: "Could not save your name." }
  } else if (rpc.error) {
    return { error: "Could not save your name." }
  }

  revalidatePath("/", "layout")
  revalidatePath("/profile")
  return { saved: true }
}

export async function changePassword(
  _state: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (password.length < 10) {
    return { error: "Use a password with at least 10 characters." }
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." }
  }

  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError || !auth.user) return { error: "You must be signed in." }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { error: "Could not save that password. Use at least 10 characters and try again." }
  }

  return { saved: true }
}
