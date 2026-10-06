"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import { createClient } from "@/lib/supabase/server"

const validRoles = ["owner", "accountant", "staff"]

export type UpdateRoleResult = {
  error: string | null
}

export async function updateUserRole(
  userId: string,
  role: string,
): Promise<UpdateRoleResult> {
  if (!isUuid(userId)) return { error: "That user could not be found." }
  if (!validRoles.includes(role)) return { error: "Choose a valid role." }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .limit(1)

  if (!myProfile || myProfile.length === 0 || myProfile[0].role !== "owner") {
    return { error: "Only owners can change roles." }
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id")

  if (error) return { error: "Could not update this user's role." }
  if (!data || data.length === 0)
    return { error: "That user could not be found." }

  revalidatePath("/settings/users")
  return { error: null }
}
