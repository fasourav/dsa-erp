import { Suspense } from "react"
import { redirect } from "next/navigation"

import { DashboardMain } from "@/app/(app)/dashboard/dashboard-sections"
import { DashboardView } from "@/app/(app)/dashboard/dashboard-view"
import { DashboardSkeleton } from "@/app/(app)/dashboard/loading"
import { allows, hasFullDashboardAccess } from "@/lib/access"
import { getCurrentUser } from "@/lib/auth"
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
  const [, user, access, params] = await Promise.all([
    requireModule("dashboard"),
    getCurrentUser(),
    getAccess(),
    searchParams,
  ])

  if (!user?.email) {
    redirect("/login")
  }

  if (!access || !hasFullDashboardAccess(access)) {
    return <DashboardView model={null} error={null} limited />
  }

  const requested = Array.isArray(params.year) ? params.year[0] : params.year
  const currentYear = Number(dhakaToday(new Date()).slice(0, 4))
  const scopeYear = parseDashboardYear(requested, currentYear)
  const showAssets = Boolean(access && allows(access, "assets", "view"))

  return (
    <Suspense key={scopeYear ?? "all"} fallback={<DashboardSkeleton />}>
      <DashboardMain scopeYear={scopeYear} showAssets={showAssets} />
    </Suspense>
  )
}
