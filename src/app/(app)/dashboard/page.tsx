import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth"

export const metadata = {
  title: "Dashboard",
}

export default async function DashboardPage() {
  const user = await getCurrentUser()

  if (!user?.email) {
    redirect("/login")
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
      <p className="mt-6 text-sm text-muted-foreground">Signed in as</p>
      <p className="mt-1 font-mono text-base">{user.email}</p>
    </div>
  )
}
