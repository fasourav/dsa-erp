import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return null
  }

  return data.user
})
