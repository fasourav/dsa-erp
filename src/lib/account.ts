import { cache } from "react"

import { roleLabel, type AccountIdentity } from "@/lib/account-identity"
import { getAccess } from "@/lib/permissions"

export type { AccountIdentity } from "@/lib/account-identity"

/** Mapped from the cached access snapshot so the shell does not read profiles again. */
export const getAccountIdentity = cache(async (): Promise<AccountIdentity | null> => {
  const access = await getAccess()
  if (!access) return null

  return {
    name: access.displayName,
    email: access.email,
    role: access.role,
    roleLabel: roleLabel(access.role),
    designation: access.designation,
  }
})
