"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { ProjectSummarySection } from "@/app/(app)/projects/[id]/project-summary-section"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import type { BacklogEntry, ProjectDetail, ProjectOverview } from "@/lib/project-detail"

export function ProjectDetailPanel({
  project,
  overview,
  backlog,
}: {
  project: ProjectDetail
  overview: ProjectOverview
  backlog: BacklogEntry | null
}) {
  const meta = [project.projectType, project.location].filter(Boolean).join(" · ")

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="flex items-start gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-1.5 shrink-0 md:mt-2"
          nativeButton={false}
          render={<Link href="/projects" aria-label="Back to projects" />}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </Button>
        <PageHeader
          className="mb-0 min-w-0 flex-1 md:mb-2"
          eyebrow={project.clientName || undefined}
          title={
            <span className="inline-flex flex-wrap items-center gap-2.5">
              <span>{project.name}</span>
              <StatusBadge status={project.status} />
            </span>
          }
          description={meta || undefined}
        />
      </div>

      <ProjectSummarySection
        project={project}
        overview={overview}
        backlog={backlog}
      />
    </div>
  )
}
