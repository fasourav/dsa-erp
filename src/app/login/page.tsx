import { redirect } from "next/navigation"

import { AuthStage } from "@/app/login/auth-stage"
import { LoginForm } from "@/app/login/login-form"
import { getCurrentUser } from "@/lib/auth"

export const metadata = {
  title: "Sign in",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>
}) {
  const user = await getCurrentUser()

  if (user) {
    redirect("/dashboard")
  }

  const params = await searchParams
  const error = Array.isArray(params.error) ? params.error[0] : params.error
  const inviteError =
    error === "invite"
      ? "That invite link is invalid or has expired. Ask an owner to send a new invite."
      : undefined

  return (
    <AuthStage
      title="Sign in"
      description="Use the email and password for your invited account."
    >
      <LoginForm notice={inviteError} />
    </AuthStage>
  )
}
