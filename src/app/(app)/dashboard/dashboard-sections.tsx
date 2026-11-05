import { DashboardView } from "@/app/(app)/dashboard/dashboard-view"
import { getDashboard } from "@/lib/dashboard-data"
import { getProjectsOverBudget } from "@/lib/project-budget"

export async function DashboardMain({
  scopeYear,
  showAssets,
}: {
  scopeYear: number | null
  showAssets: boolean
}) {
  const [{ model, error }, overBudget] = await Promise.all([
    getDashboard(scopeYear, new Date(), showAssets),
    getProjectsOverBudget(),
  ])

  return (
    <DashboardView
      model={model}
      error={error}
      overBudget={overBudget}
      showAssets={showAssets}
    />
  )
}
