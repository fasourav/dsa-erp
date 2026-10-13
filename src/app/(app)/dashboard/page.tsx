import { redirect } from "next/navigation"

import { DashboardView } from "@/app/(app)/dashboard/dashboard-view"
import { hasFullDashboardAccess } from "@/lib/access"
import { getCurrentUser } from "@/lib/auth"
import { getDashboard } from "@/lib/dashboard-data"
import { getAccess, requireModule } from "@/lib/permissions"

export const metadata = {
  title: "Dashboard",
}

export default async function DashboardPage() {
  await requireModule("dashboard")
  const user = await getCurrentUser()

  if (!user?.email) {
    redirect("/login")
  }

  const access = await getAccess()
  if (!access || !hasFullDashboardAccess(access)) {
    return <DashboardView model={null} error={null} limited />
  }

  const { model, error } = await getDashboard()

  return <DashboardView model={model} error={error} />
}
