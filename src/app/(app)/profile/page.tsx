import { redirect } from "next/navigation"

import { ProfileForm } from "@/app/(app)/profile/profile-form"
import { PageHeader } from "@/components/page-header"
import { getAccountIdentity } from "@/lib/account"
import { signedMediaUrl } from "@/lib/profile-media"
import { getAccess } from "@/lib/permissions"

export const metadata = { title: "My Profile" }

export default async function ProfilePage() {
  const [account, access] = await Promise.all([getAccountIdentity(), getAccess()])
  if (!account) redirect("/login")
  const signatureUrl = await signedMediaUrl(access?.signaturePath ?? null)

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader title="My Profile" className="mb-0 md:mb-2" />
      <ProfileForm
        name={account.name}
        email={account.email}
        roleLabel={account.roleLabel}
        designation={account.designation}
        avatarUrl={account.avatarUrl}
        signatureUrl={signatureUrl}
      />
    </div>
  )
}
