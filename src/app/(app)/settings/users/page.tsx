import { UsersPanel } from "@/app/(app)/settings/users/users-panel"
import { getUserDirectory } from "@/app/(app)/settings/users/queries"
import { getAccess, requireOwner } from "@/lib/permissions"

export const metadata = { title: "Users & Permissions" }

export default async function UsersPage() {
  await requireOwner()
  const access = await getAccess()
  const directory = await getUserDirectory()

  return (
    <UsersPanel
      currentUserId={access?.userId ?? ""}
      users={directory.users}
      modules={directory.modules}
      templates={directory.templates}
      error={directory.error}
    />
  )
}
