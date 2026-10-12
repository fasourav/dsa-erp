import { redirect } from "next/navigation"

import { AuthStage } from "@/app/login/auth-stage"
import { SetPasswordForm } from "@/app/set-password/set-password-form"
import { getCurrentUser } from "@/lib/auth"

export const metadata = {
  title: "Set Password",
}

export default async function SetPasswordPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return (
    <AuthStage
      title="Set Password"
      description="Choose a password with at least 10 characters for your invited account."
    >
      <SetPasswordForm />
    </AuthStage>
  )
}
