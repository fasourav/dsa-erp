import { cache } from "react"
import { redirect } from "next/navigation"

import {
  allows,
  type AccessSnapshot,
  type ModuleKey,
  type PermissionAction,
} from "@/lib/access"
import { createClient } from "@/lib/supabase/server"

export const getAccess = cache(async (): Promise<AccessSnapshot | null> => {
  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()

  if (authError || !auth.user) return null

  const profile = await loadProfile(supabase, auth.user.id)
  if (!profile) return null

  const [{ data: grants }, { data: modules }] = await Promise.all([
    supabase
      .from("user_permissions")
      .select("module, can_view, can_add, can_edit, can_delete")
      .eq("user_id", auth.user.id),
    supabase.from("permission_modules").select("key, owners_only"),
  ])

  const status = profile.status
  if (status !== "active" && status !== "invited" && status !== "deactivated") {
    return null
  }

  return {
    userId: auth.user.id,
    role: profile.role,
    status,
    showFinancials: profile.show_financials,
    isOwner: profile.role === "owner" && status === "active",
    displayName: profile.display_name?.trim() || profile.email?.trim() || "User",
    email: profile.email ?? "",
    designation: profile.designation?.trim() || null,
    ownersOnly: (modules ?? []).filter((row) => row.owners_only).map((row) => row.key),
    grants: Object.fromEntries(
      (grants ?? []).map((row) => [
        row.module,
        {
          view: row.can_view,
          add: row.can_add,
          edit: row.can_edit,
          delete: row.can_delete,
        },
      ]),
    ),
  }
})

export async function denyUnless(
  module: ModuleKey,
  action: PermissionAction,
): Promise<string | null> {
  const access = await getAccess()
  if (!access || access.status === "deactivated") return "Your session has expired. Sign in again."
  if (!allows(access, module, action)) return "You do not have permission to do that."
  return null
}

export async function denyUnlessOwner(): Promise<string | null> {
  const access = await getAccess()
  if (!access || access.status === "deactivated") return "Your session has expired. Sign in again."
  if (!access.isOwner) return "Only owners can do that."
  return null
}

export async function requireModule(module: ModuleKey, action: PermissionAction = "view") {
  const access = await getAccess()
  if (!access || access.status === "deactivated") redirect("/login")
  if (!allows(access, module, action)) redirect("/no-access")
}

export async function requireOwner() {
  const access = await getAccess()
  if (!access || access.status === "deactivated") redirect("/login")
  if (!access.isOwner) redirect("/no-access")
}

type ProfileRow = {
  role: string
  status: string
  show_financials: boolean
  display_name: string | null
  email: string | null
  designation: string | null
}

/** One profile read for access and the shell identity. Retries without designation if that column is absent. */
async function loadProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<ProfileRow | null> {
  const rich = await supabase
    .from("profiles")
    .select("role, status, show_financials, display_name, email, designation")
    .eq("id", userId)
    .maybeSingle()

  if (rich.error && /designation/i.test(rich.error.message)) {
    const basic = await supabase
      .from("profiles")
      .select("role, status, show_financials, display_name, email")
      .eq("id", userId)
      .maybeSingle()
    if (basic.error || !basic.data) return null
    return { ...basic.data, designation: null }
  }

  if (rich.error || !rich.data) return null
  return rich.data
}
