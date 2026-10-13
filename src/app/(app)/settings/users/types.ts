export type PermissionFlags = {
  canView: boolean
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}

export type PermissionMatrix = Record<string, PermissionFlags>

export type ModuleOption = {
  key: string
  label: string
  ownersOnly: boolean
}

export type RoleTemplateOption = {
  id: string
  key: string
  label: string
  showFinancials: boolean
  permissions: PermissionMatrix
}

export type DirectoryUser = {
  id: string
  displayName: string
  designation: string
  email: string
  role: string
  status: "active" | "invited" | "deactivated"
  showFinancials: boolean
  lastSignInAt: string | null
  permissions: PermissionMatrix
}

export type AccessInput = {
  displayName: string
  designation: string
  email: string
  role: string
  showFinancials: boolean
  permissions: Array<PermissionFlags & { module: string }>
}

export const emptyFlags = (): PermissionFlags => ({
  canView: false,
  canAdd: false,
  canEdit: false,
  canDelete: false,
})
