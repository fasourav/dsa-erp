import { AcceptInvite } from "@/app/auth/accept/accept-invite"
import { AuthStage } from "@/app/login/auth-stage"
import { requestOrigin } from "@/lib/documents/origin"

export const metadata = {
  title: "Accept Invite",
}

export default async function AcceptInvitePage() {
  const origin = await requestOrigin()

  return (
    <AuthStage title="Accept Invite">
      <AcceptInvite origin={origin} />
    </AuthStage>
  )
}
