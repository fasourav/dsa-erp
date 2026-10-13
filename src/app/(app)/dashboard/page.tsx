import { redirect } from "next/navigation"

import { DashboardView } from "@/app/(app)/dashboard/dashboard-view"
import { hasFullDashboardAccess } from "@/lib/access"
import { getCurrentUser } from "@/lib/auth"
import { getDashboard } from "@/lib/dashboard-data"
import { dhakaToday, parseDashboardYear } from "@/lib/dashboard-metrics"
import { getAccess, requireModule } from "@/lib/permissions"

export const metadata = {
  title: "Dashboard",
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string | string[] }>
}) {
  await requireModule("dashboard")
  const user = await getCurrentUser()

  if (!user?.email) {
    redirect("/login")
  }

  const access = await getAccess()
  if (!access || !hasFullDashboardAccess(access)) {
    return <DashboardView model={null} error={null} limited />
  }

  const params = await searchParams
  const requested = Array.isArray(params.year) ? params.year[0] : params.year
  const currentYear = Number(dhakaToday(new Date()).slice(0, 4))
  const scopeYear = parseDashboardYear(requested, currentYear)
  const { model, error } = await getDashboard(scopeYear)

  return <DashboardView model={model} error={error} />
}
