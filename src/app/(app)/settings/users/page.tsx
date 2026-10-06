import { UsersPanel } from "@/app/(app)/settings/users/users-panel"
import { getProfiles } from "@/lib/profiles"

export const metadata = { title: "Users & Roles" }

export default async function UsersPage() {
  const { profiles, error } = await getProfiles()

  return <UsersPanel profiles={profiles} error={error} />
}
