import { createClient } from "@/lib/supabase/server"

import {
  emptyFlags,
  type DirectoryUser,
  type ModuleOption,
  type PermissionMatrix,
  type RoleTemplateOption,
} from "@/app/(app)/settings/users/types"

function matrixFromRows(
  rows: Array<{
    module: string
    can_view: boolean
    can_add: boolean
    can_edit: boolean
    can_delete: boolean
  }>,
): PermissionMatrix {
  return Object.fromEntries(
    rows.map((row) => [
      row.module,
      {
        canView: row.can_view,
        canAdd: row.can_add,
        canEdit: row.can_edit,
        canDelete: row.can_delete,
      },
    ]),
  )
}

export async function getUserDirectory(): Promise<{
  users: DirectoryUser[]
  modules: ModuleOption[]
  templates: RoleTemplateOption[]
  error: string | null
}> {
  const supabase = await createClient()

  const profileColumns =
    "id, display_name, designation, email, role, status, show_financials, last_sign_in_at, created_at" as const
  const richProfiles = await supabase
    .from("profiles")
    .select(profileColumns)
    .order("created_at", { ascending: true })
  const profiles =
    richProfiles.error && /designation/i.test(richProfiles.error.message)
      ? await supabase
          .from("profiles")
          .select("id, display_name, email, role, status, show_financials, last_sign_in_at, created_at")
          .order("created_at", { ascending: true })
      : richProfiles

  const [permissions, modules, templates, templatePermissions] = await Promise.all([
    supabase
      .from("user_permissions")
      .select("user_id, module, can_view, can_add, can_edit, can_delete"),
    supabase
      .from("permission_modules")
      .select("key, label, owners_only, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("role_templates")
      .select("id, key, label, show_financials, sort_order")
      .order("sort_order", { ascending: true }),
    supabase
      .from("role_template_permissions")
      .select("template_id, module, can_view, can_add, can_edit, can_delete"),
  ])

  if (
    profiles.error ||
    permissions.error ||
    modules.error ||
    templates.error ||
    templatePermissions.error
  ) {
    return { users: [], modules: [], templates: [], error: "Could not load users." }
  }

  const permissionsByUser = new Map<string, PermissionMatrix>()
  for (const row of permissions.data ?? []) {
    const current = permissionsByUser.get(row.user_id) ?? {}
    current[row.module] = {
      canView: row.can_view,
      canAdd: row.can_add,
      canEdit: row.can_edit,
      canDelete: row.can_delete,
    }
    permissionsByUser.set(row.user_id, current)
  }

  const permissionsByTemplate = new Map<string, PermissionMatrix>()
  for (const row of templatePermissions.data ?? []) {
    const current = permissionsByTemplate.get(row.template_id) ?? {}
    current[row.module] = {
      canView: row.can_view,
      canAdd: row.can_add,
      canEdit: row.can_edit,
      canDelete: row.can_delete,
    }
    permissionsByTemplate.set(row.template_id, current)
  }

  const moduleOptions: ModuleOption[] = (modules.data ?? []).map((row) => ({
    key: row.key,
    label: row.label,
    ownersOnly: row.owners_only,
  }))

  const users: DirectoryUser[] = (profiles.data ?? []).flatMap((row) => {
    if (row.status !== "active" && row.status !== "invited" && row.status !== "deactivated") {
      return []
    }
    const grants = permissionsByUser.get(row.id) ?? {}
    const permissions = Object.fromEntries(
      moduleOptions.map((module) => [module.key, grants[module.key] ?? emptyFlags()]),
    )
    return [
      {
        id: row.id,
        displayName: row.display_name ?? "",
        designation:
          "designation" in row && typeof row.designation === "string" ? row.designation : "",
        email: row.email ?? "",
        role: row.role,
        status: row.status,
        showFinancials: row.show_financials,
        lastSignInAt: row.last_sign_in_at,
        permissions,
      },
    ]
  })

  return {
    users,
    modules: moduleOptions,
    templates: (templates.data ?? []).map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      showFinancials: row.show_financials,
      permissions: {
        ...Object.fromEntries(moduleOptions.map((module) => [module.key, emptyFlags()])),
        ...(permissionsByTemplate.get(row.id) ?? matrixFromRows([])),
      },
    })),
    error: null,
  }
}
