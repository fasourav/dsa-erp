import { cache } from "react"
import { redirect } from "next/navigation"

import {
  allows,
  homePath,
  type AccessSnapshot,
  type ModuleKey,
  type PermissionAction,
} from "@/lib/access"
import { createClient } from "@/lib/supabase/server"

export const getAccess = cache(async (): Promise<AccessSnapshot | null> => {
  const supabase = await createClient()
  const { data: auth, error: authError } = await supabase.auth.getUser()

  if (authError || !auth.user) return null

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status, show_financials")
    .eq("id", auth.user.id)
    .maybeSingle()

  if (profileError || !profile) return null

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
  if (!access || access.status === "deactivated") return "You must be signed in."
  if (!allows(access, module, action)) return "You do not have permission to do that."
  return null
}

export async function denyUnlessOwner(): Promise<string | null> {
  const access = await getAccess()
  if (!access || access.status === "deactivated") return "You must be signed in."
  if (!access.isOwner) return "Only owners can do that."
  return null
}

export async function requireModule(module: ModuleKey) {
  const access = await getAccess()
  if (!access || access.status === "deactivated") redirect("/login")
  if (!allows(access, module, "view")) redirect(homePath(access))
}

export async function requireOwner() {
  const access = await getAccess()
  if (!access || access.status === "deactivated") redirect("/login")
  if (!access.isOwner) redirect(homePath(access))
}
