import { AcceptInvite } from "@/app/auth/accept/accept-invite"
import { AuthStage } from "@/app/login/auth-stage"

export const metadata = {
  title: "Accept Invite",
}

export default function AcceptInvitePage() {
  return (
    <AuthStage title="Accept Invite">
      <AcceptInvite />
    </AuthStage>
  )
}
