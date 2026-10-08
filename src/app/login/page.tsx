import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { LoginBackground } from "@/app/login/login-background"
import { LoginForm } from "@/app/login/login-form"
import { BrandLockup } from "@/components/brand-mark"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"
import { parseTheme, THEME_COOKIE } from "@/lib/theme"

export const metadata = {
  title: "Sign in",
}

export default async function LoginPage() {
  const user = await getCurrentUser()

  if (user) {
    redirect("/dashboard")
  }

  const cookieStore = await cookies()
  const theme = parseTheme(cookieStore.get(THEME_COOKIE)?.value)

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-x-hidden px-4 py-10 sm:py-16">
      <div className="absolute inset-0" aria-hidden="true">
        <LoginBackground lightMode={theme === "light"} />
      </div>
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        <BrandLockup layout="stacked" priority className="w-full" />
        <Card className="relative w-full rounded-3xl border border-foreground/10 bg-card/70 shadow-2xl ring-foreground/10 backdrop-blur-2xl backdrop-saturate-150 before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-foreground/25">
          <CardHeader className="gap-1.5">
            <h1 className="font-heading text-2xl leading-tight font-medium tracking-tight">
              Sign in
            </h1>
            <CardDescription className="text-sm leading-relaxed">
              Use the email and password for your invited account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
