import { redirect } from "next/navigation"

import { AuthStage } from "@/app/login/auth-stage"
import { LoginForm } from "@/app/login/login-form"
import { getCurrentUser } from "@/lib/auth"
import { safeNextPath } from "@/lib/safe-next"

export const metadata = {
  title: "Sign in",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>
}) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams])
  const rawNext = Array.isArray(params.next) ? params.next[0] : params.next
  const next = safeNextPath(rawNext)

  if (user) {
    redirect(next ?? "/dashboard")
  }

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
      <LoginForm notice={inviteError} next={next} />
    </AuthStage>
  )
}
