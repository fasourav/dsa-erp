import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { AccessProvider } from "@/components/access-provider"
import { AppShell } from "@/components/app-shell"
import { getAccountIdentity } from "@/lib/account"
import { getAccess } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { parseThemePreference, THEME_COOKIE } from "@/lib/theme"

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const access = await getAccess()

  if (!access || access.status === "deactivated") {
    if (access?.status === "deactivated") {
      const supabase = await createClient()
      await supabase.auth.signOut()
    }
    redirect("/login")
  }

  const account = await getAccountIdentity()
  if (!account) redirect("/login")

  const cookieStore = await cookies()
  const theme = parseThemePreference(cookieStore.get(THEME_COOKIE)?.value)

  return (
    <AccessProvider access={access}>
      <AppShell theme={theme} account={account}>
        {children}
      </AppShell>
    </AccessProvider>
  )
}
