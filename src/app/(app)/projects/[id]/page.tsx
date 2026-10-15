import { notFound } from "next/navigation"

import { ProjectDetailPanel } from "@/app/(app)/projects/[id]/project-detail-panel"
import { allows } from "@/lib/access"
import { isUuid } from "@/lib/ids"
import { getProjectBudget } from "@/lib/project-budget"
import { getProjectDetail } from "@/lib/project-detail"
import { getProjectProgress } from "@/lib/project-progress-data"
import { getAccess, requireModule } from "@/lib/permissions"

export const metadata = { title: "Project Detail" }

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModule("projects")
  const { id } = await params
  if (!isUuid(id)) notFound()

  const [{ project, overview, backlog }, { progress, error }, budget, access] = await Promise.all([
    getProjectDetail(id),
    getProjectProgress(id),
    getProjectBudget(id),
    getAccess(),
  ])
  if (!project || !overview) notFound()

  return (
    <ProjectDetailPanel
      project={project}
      overview={overview}
      backlog={backlog}
      progress={progress}
      progressError={error}
      budget={budget}
      canAddBudget={Boolean(access && allows(access, "project_budgets", "add"))}
      canEditBudget={Boolean(access && allows(access, "project_budgets", "edit"))}
      canDeleteBudget={Boolean(access && allows(access, "project_budgets", "delete"))}
    />
  )
}
