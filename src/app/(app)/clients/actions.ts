"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"

const clientIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type DeleteClientResult = {
  error: string | null
}

export async function deleteClient(id: string): Promise<DeleteClientResult> {
  if (!clientIdPattern.test(id)) {
    return { error: "That client could not be found." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return {
        error:
          "This client is linked to projects or invoices and cannot be deleted.",
      }
    }

    return { error: "Could not delete this client." }
  }

  if (!data || data.length === 0) {
    return { error: "That client could not be found." }
  }

  revalidatePath("/clients")
  return { error: null }
}
