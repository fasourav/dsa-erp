"use server"

import type { AccessInput } from "@/app/(app)/settings/users/types"
import { requestOrigin } from "@/lib/documents/origin"
import { isUuid } from "@/lib/ids"
import { denyUnlessOwner, getAccess } from "@/lib/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidateSettings } from "@/lib/revalidate-settings"
import { createClient } from "@/lib/supabase/server"

export type ActionResult = {
  error: string | null
}

function missingDesignation(message: string | undefined) {
  return Boolean(message && /designation/i.test(message))
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function friendly(message: string | undefined, fallback: string): string {
  if (!message) return fallback
  if (/at least one active owner/i.test(message)) {
    return "At least one active owner must remain."
  }
  if (/cannot change your own/i.test(message)) {
    return "You cannot change your own role or permissions."
  }
  if (/already been registered|already exists/i.test(message)) {
    return "A user with this email already exists."
  }
  return fallback
}

function cleanInput(input: AccessInput): { error: string } | { value: AccessInput } {
  const displayName = input.displayName.replace(/\s+/g, " ").trim()
  const designation = input.designation.replace(/\s+/g, " ").trim()
  const email = input.email.trim().toLowerCase()
  const role = input.role.trim()

  if (!displayName) return { error: "Enter a full name." }
  if (displayName.length > 120) return { error: "Use a shorter name." }
  if (designation.length > 80) return { error: "Use a shorter designation." }
  if (!emailPattern.test(email)) return { error: "Enter a valid email." }
  if (!role) return { error: "Choose a role template." }
  if (!Array.isArray(input.permissions)) return { error: "Choose module access." }

  return {
    value: {
      displayName,
      designation,
      email,
      role,
      showFinancials: Boolean(input.showFinancials),
      permissions: input.permissions.filter(
        (row) =>
          row &&
          typeof row.module === "string" &&
          typeof row.canView === "boolean" &&
          typeof row.canAdd === "boolean" &&
          typeof row.canEdit === "boolean" &&
          typeof row.canDelete === "boolean",
      ),
    },
  }
}

async function inviteRedirect(): Promise<string> {
  const site = await requestOrigin()
  return `${site}/auth/accept`
}

async function replacePermissions(
  userId: string,
  role: string,
  permissions: AccessInput["permissions"],
) {
  const supabase = await createClient()
  const { data: modules, error: moduleError } = await supabase
    .from("permission_modules")
    .select("key, owners_only")

  if (moduleError) return "Could not save permissions."

  const allowed = new Map((modules ?? []).map((row) => [row.key, row.owners_only]))
  const rows = permissions.flatMap((row) => {
    if (!allowed.has(row.module)) return []
    const ownersOnly = allowed.get(row.module) === true
    const locked = ownersOnly && role !== "owner"
    return [
      {
        user_id: userId,
        module: row.module,
        can_view: locked ? false : row.canView,
        can_add: locked ? false : row.canAdd,
        can_edit: locked ? false : row.canEdit,
        can_delete: locked ? false : row.canDelete,
      },
    ]
  })

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("user_permissions")
      .upsert(rows, { onConflict: "user_id,module" })
    if (upsertError) return friendly(upsertError.message, "Could not save permissions.")
  }

  const kept = rows.map((row) => row.module)
  let stale = supabase.from("user_permissions").delete().eq("user_id", userId)
  if (kept.length > 0) {
    stale = stale.not("module", "in", `(${kept.join(",")})`)
  }
  const { error: deleteError } = await stale
  if (deleteError) return friendly(deleteError.message, "Could not save permissions.")
  return null
}

async function assertRole(role: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("role_templates")
    .select("key")
    .eq("key", role)
    .maybeSingle()

  if (error || !data) return "Choose a valid role."
  return null
}

export async function inviteUser(input: AccessInput): Promise<ActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }

  const cleaned = cleanInput(input)
  if ("error" in cleaned) return { error: cleaned.error }

  const roleError = await assertRole(cleaned.value.role)
  if (roleError) return { error: roleError }

  const admin = createAdminClient()
  if (!admin) {
    return { error: "Invites are not configured. Add the service role key on the server." }
  }

  const supabase = await createClient()
  const { error: inviteRowError } = await supabase.from("user_invites").upsert({
    email: cleaned.value.email,
    role: cleaned.value.role,
    show_financials: cleaned.value.showFinancials,
    display_name: cleaned.value.displayName,
  })

  if (inviteRowError) {
    return { error: "Could not send this invite." }
  }

  const invited = await admin.auth.admin.inviteUserByEmail(cleaned.value.email, {
    data: {
      display_name: cleaned.value.displayName,
    },
    redirectTo: await inviteRedirect(),
  })

  if (invited.error || !invited.data.user) {
    await supabase.from("user_invites").delete().eq("email", cleaned.value.email)
    return { error: friendly(invited.error?.message, "Could not send this invite.") }
  }

  const userId = invited.data.user.id
  const profileRow = {
    id: userId,
    display_name: cleaned.value.displayName,
    designation: cleaned.value.designation || null,
    email: cleaned.value.email,
    role: cleaned.value.role,
    status: "invited" as const,
    show_financials: cleaned.value.showFinancials,
  }
  let profileError = (
    await supabase.from("profiles").upsert(profileRow)
  ).error

  if (missingDesignation(profileError?.message)) {
    profileError = (
      await supabase.from("profiles").upsert({
        id: profileRow.id,
        display_name: profileRow.display_name,
        email: profileRow.email,
        role: profileRow.role,
        status: profileRow.status,
        show_financials: profileRow.show_financials,
      })
    ).error
  }

  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: friendly(profileError.message, "Could not send this invite.") }
  }

  const permissionError = await replacePermissions(
    userId,
    cleaned.value.role,
    cleaned.value.permissions,
  )
  if (permissionError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: permissionError }
  }

  revalidateSettings("users")
  return { error: null }
}

export async function saveUserAccess(
  userId: string,
  input: AccessInput,
): Promise<ActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }
  if (!isUuid(userId)) return { error: "That user could not be found." }

  const cleaned = cleanInput(input)
  if ("error" in cleaned) return { error: cleaned.error }

  const access = await getAccess()
  if (!access) return { error: "You must be signed in." }

  const supabase = await createClient()

  if (userId === access.userId) {
    const updateSelf = async (includeDesignation: boolean) =>
      supabase
        .from("profiles")
        .update(
          includeDesignation
            ? {
                display_name: cleaned.value.displayName,
                designation: cleaned.value.designation || null,
              }
            : { display_name: cleaned.value.displayName },
        )
        .eq("id", userId)
        .select("id")

    let updated = await updateSelf(true)
    if (missingDesignation(updated.error?.message)) updated = await updateSelf(false)
    if (updated.error) return { error: friendly(updated.error.message, "Could not update this user.") }
    revalidateSettings("users")
    return { error: null }
  }

  const roleError = await assertRole(cleaned.value.role)
  if (roleError) return { error: roleError }

  const updateOther = async (includeDesignation: boolean) =>
    supabase
      .from("profiles")
      .update(
        includeDesignation
          ? {
              display_name: cleaned.value.displayName,
              designation: cleaned.value.designation || null,
              role: cleaned.value.role,
              show_financials: cleaned.value.showFinancials,
            }
          : {
              display_name: cleaned.value.displayName,
              role: cleaned.value.role,
              show_financials: cleaned.value.showFinancials,
            },
      )
      .eq("id", userId)
      .select("id")

  let updated = await updateOther(true)
  if (missingDesignation(updated.error?.message)) updated = await updateOther(false)

  if (updated.error) return { error: friendly(updated.error.message, "Could not update this user.") }
  if (!updated.data || updated.data.length === 0) return { error: "That user could not be found." }

  const permissionError = await replacePermissions(
    userId,
    cleaned.value.role,
    cleaned.value.permissions,
  )
  if (permissionError) return { error: permissionError }

  revalidateSettings("users")
  return { error: null }
}

export async function resendInvite(userId: string): Promise<ActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }
  if (!isUuid(userId)) return { error: "That user could not be found." }

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("email, status")
    .eq("id", userId)
    .maybeSingle()

  if (error || !profile) return { error: "That user could not be found." }
  if (profile.status !== "invited" || !profile.email) {
    return { error: "This invite is no longer pending." }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { error: "Invites are not configured. Add the service role key on the server." }
  }

  const sent = await admin.auth.admin.inviteUserByEmail(profile.email, {
    redirectTo: await inviteRedirect(),
  })
  if (sent.error) return { error: friendly(sent.error.message, "Could not resend this invite.") }

  revalidateSettings("users")
  return { error: null }
}

export async function cancelInvite(userId: string): Promise<ActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }
  if (!isUuid(userId)) return { error: "That user could not be found." }

  const access = await getAccess()
  if (access?.userId === userId) return { error: "You cannot cancel your own access." }

  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle()

  if (error || !profile) return { error: "That user could not be found." }
  if (profile.status !== "invited") return { error: "This invite is no longer pending." }

  const admin = createAdminClient()
  if (!admin) {
    return { error: "Invites are not configured. Add the service role key on the server." }
  }

  const removed = await admin.auth.admin.deleteUser(userId)
  if (removed.error) return { error: friendly(removed.error.message, "Could not cancel this invite.") }

  revalidateSettings("users")
  return { error: null }
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }
  if (!isUuid(userId)) return { error: "That user could not be found." }

  const access = await getAccess()
  if (access?.userId === userId) {
    return { error: active ? "You are already signed in." : "You cannot deactivate yourself." }
  }

  const admin = createAdminClient()
  if (!admin) {
    return { error: "User status is not configured. Add the service role key on the server." }
  }

  const supabase = await createClient()
  const ban = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h",
  })
  if (ban.error) {
    return { error: active ? "Could not reactivate this user." : "Could not deactivate this user." }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ status: active ? "active" : "deactivated" })
    .eq("id", userId)
    .select("id")

  if (error || !data || data.length === 0) {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: active ? "876000h" : "none",
    })
    return {
      error: friendly(
        error?.message,
        active ? "Could not reactivate this user." : "Could not deactivate this user.",
      ),
    }
  }

  revalidateSettings("users")
  return { error: null }
}

export async function saveRoleTemplate(
  templateId: string,
  showFinancials: boolean,
  permissions: AccessInput["permissions"],
): Promise<ActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }
  if (!isUuid(templateId)) return { error: "That role template could not be found." }

  const supabase = await createClient()
  const { data: template, error: templateError } = await supabase
    .from("role_templates")
    .select("id, key")
    .eq("id", templateId)
    .maybeSingle()

  if (templateError || !template) return { error: "That role template could not be found." }

  const { error: updateError } = await supabase
    .from("role_templates")
    .update({ show_financials: showFinancials })
    .eq("id", templateId)

  if (updateError) return { error: "Could not update this role template." }

  const { data: modules, error: moduleError } = await supabase
    .from("permission_modules")
    .select("key, owners_only")

  if (moduleError) return { error: "Could not update this role template." }

  const allowed = new Map((modules ?? []).map((row) => [row.key, row.owners_only]))
  const rows = permissions.flatMap((row) => {
    if (!allowed.has(row.module)) return []
    const locked = allowed.get(row.module) === true && template.key !== "owner"
    return [
      {
        template_id: templateId,
        module: row.module,
        can_view: locked ? false : row.canView,
        can_add: locked ? false : row.canAdd,
        can_edit: locked ? false : row.canEdit,
        can_delete: locked ? false : row.canDelete,
      },
    ]
  })

  const { error: deleteError } = await supabase
    .from("role_template_permissions")
    .delete()
    .eq("template_id", templateId)

  if (deleteError) return { error: "Could not update this role template." }
  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("role_template_permissions").insert(rows)
    if (insertError) return { error: "Could not update this role template." }
  }

  revalidateSettings("users")
  return { error: null }
}
