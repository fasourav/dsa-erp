import { cookies } from "next/headers"

import { AcceptInvite } from "@/app/auth/accept/accept-invite"
import { parseTheme, THEME_COOKIE } from "@/lib/theme"

export const metadata = {
  title: "Accept Invite",
}

export default async function AcceptInvitePage() {
  const cookieStore = await cookies()
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value)

  return <AcceptInvite lightMode={theme === "light"} />
}
