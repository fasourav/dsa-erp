import { notFound } from "next/navigation"

import { ProjectDetailPanel } from "@/app/(app)/projects/[id]/project-detail-panel"
import { isUuid } from "@/lib/ids"
import { getProjectDetail } from "@/lib/project-detail"

export const metadata = { title: "Project Detail" }

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const { project, overview, backlog } = await getProjectDetail(id)
  if (!project || !overview) notFound()

  return (
    <ProjectDetailPanel
      project={project}
      overview={overview}
      backlog={backlog}
    />
  )
}
