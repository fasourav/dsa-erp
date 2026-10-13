import { redirect } from "next/navigation"

import { ProfileForm } from "@/app/(app)/profile/profile-form"
import { getAccountIdentity } from "@/lib/account"

export const metadata = { title: "My Profile" }

export default async function ProfilePage() {
  const account = await getAccountIdentity()
  if (!account) redirect("/login")

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Account / My Profile</p>
        <h1 className="text-2xl font-medium tracking-tight">My Profile</h1>
      </div>
      <ProfileForm
        name={account.name}
        email={account.email}
        roleLabel={account.roleLabel}
        designation={account.designation}
      />
    </div>
  )
}
