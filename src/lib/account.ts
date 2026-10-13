import { cache } from "react"

import { roleLabel, type AccountIdentity } from "@/lib/account-identity"
import { getAccess } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

export type { AccountIdentity } from "@/lib/account-identity"

export const getAccountIdentity = cache(async (): Promise<AccountIdentity | null> => {
  const access = await getAccess()
  if (!access) return null

  const supabase = await createClient()
  const rich = await supabase
    .from("profiles")
    .select("display_name, email, role, designation")
    .eq("id", access.userId)
    .maybeSingle()

  if (rich.error && /designation/i.test(rich.error.message)) {
    const basic = await supabase
      .from("profiles")
      .select("display_name, email, role")
      .eq("id", access.userId)
      .maybeSingle()

    if (basic.error || !basic.data) {
      return {
        name: "User",
        email: "",
        role: access.role,
        roleLabel: roleLabel(access.role),
        designation: null,
      }
    }

    return {
      name: basic.data.display_name?.trim() || basic.data.email?.trim() || "User",
      email: basic.data.email ?? "",
      role: basic.data.role,
      roleLabel: roleLabel(basic.data.role),
      designation: null,
    }
  }

  if (rich.error || !rich.data) {
    return {
      name: "User",
      email: "",
      role: access.role,
      roleLabel: roleLabel(access.role),
      designation: null,
    }
  }

  return {
    name: rich.data.display_name?.trim() || rich.data.email?.trim() || "User",
    email: rich.data.email ?? "",
    role: rich.data.role,
    roleLabel: roleLabel(rich.data.role),
    designation: rich.data.designation?.trim() || null,
  }
})
