import { redirect } from "next/navigation"

import { LoginForm } from "@/app/login/login-form"
import { BrandLockup } from "@/components/brand-mark"
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
          <BrandLockup layout="stacked" priority className="mb-2" />
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
