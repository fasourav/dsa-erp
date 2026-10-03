import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AppShell } from "@/components/app-shell"
import { getCurrentUser } from "@/lib/auth"
import { parseTheme, THEME_COOKIE } from "@/lib/theme"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  const cookieStore = await cookies()
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value)

  return <AppShell theme={theme}>{children}</AppShell>
}
