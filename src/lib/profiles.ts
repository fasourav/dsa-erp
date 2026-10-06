import { createClient } from "@/lib/supabase/server"

export type ProfileRow = {
  id: string
  role: string
  displayName: string
  email: string
}

export async function getProfiles(): Promise<{
  profiles: ProfileRow[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, role, display_name")
      .order("created_at", { ascending: true })

    if (error) throw error

    const profiles: ProfileRow[] = (data ?? []).map((p) => ({
      id: p.id,
      role: p.role,
      displayName: p.display_name ?? "",
      email: "",
    }))

    return { profiles, error: null }
  } catch {
    return { profiles: [], error: "Could not load user profiles." }
  }
}
