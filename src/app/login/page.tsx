import { redirect } from "next/navigation"

import { LoginForm } from "@/app/login/login-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCurrentUser } from "@/lib/auth"

export const metadata = {
  title: "Sign in",
}

export default async function LoginPage() {
  const user = await getCurrentUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-[0.68rem] font-medium tracking-[0.22em] text-muted-foreground">
            DYNAMIC SPACE ARCHITECTS
          </p>
          <CardTitle className="text-xl">Sign in to DSA ERP</CardTitle>
          <CardDescription>
            Use the email and password for your invited account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
