"use server"

import { redirect } from "next/navigation"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export type SetPasswordState = {
  error?: string
}

export async function setPassword(
  _state: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
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
  if (authError || !auth.user) {
    redirect("/login?error=invite")
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", auth.user.id)
    .maybeSingle()

  if (profileError || !profile) {
    return { error: "Your account is not ready yet. Ask an owner to send a new invite." }
  }
  if (profile.status !== "invited" && profile.status !== "active") {
    return { error: "This account cannot be activated. Ask an owner for help." }
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password })
  if (passwordError) {
    return { error: "Could not save that password. Use at least 10 characters and try again." }
  }

  if (profile.status === "invited") {
    const admin = createAdminClient()
    if (!admin) {
      return {
        error: "Your password was saved, but your account could not be activated. Ask an owner for help.",
      }
    }

    const { error: statusError } = await admin
      .from("profiles")
      .update({ status: "active" })
      .eq("id", auth.user.id)
      .eq("status", "invited")

    if (statusError) {
      return {
        error: "Your password was saved, but your account could not be activated. Ask an owner for help.",
      }
    }

    const { data: refreshed, error: refreshError } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", auth.user.id)
      .maybeSingle()

    if (refreshError || refreshed?.status !== "active") {
      return {
        error: "Your password was saved, but your account could not be activated. Ask an owner for help.",
      }
    }
  }

  redirect("/dashboard")
}
