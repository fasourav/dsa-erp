import { notFound } from "next/navigation"

import { ProjectDetailPanel } from "@/app/(app)/projects/[id]/project-detail-panel"
import { isUuid } from "@/lib/ids"
import { getProjectDetail } from "@/lib/project-detail"
import { getProjectProgress } from "@/lib/project-progress-data"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Project Detail" }

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModule("projects")
  const { id } = await params
  if (!isUuid(id)) notFound()

  const [{ project, overview, backlog }, { progress, error }] = await Promise.all([
    getProjectDetail(id),
    getProjectProgress(id),
  ])
  if (!project || !overview) notFound()

  return (
    <ProjectDetailPanel
      project={project}
      overview={overview}
      backlog={backlog}
      progress={progress}
      progressError={error}
    />
  )
}
