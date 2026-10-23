"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { ProjectSummarySection } from "@/app/(app)/projects/[id]/project-summary-section"
import { BudgetStatusBadge } from "@/app/(app)/projects/budget-status-badge"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import type { ProjectBudgetSnapshot } from "@/lib/project-budget-model"
import type { BacklogEntry, ProjectDetail, ProjectOverview } from "@/lib/project-detail"
import type { ProjectProgressData } from "@/lib/project-progress"

export function ProjectDetailPanel({
  project,
  overview,
  backlog,
  progress,
  progressError,
  budget,
  canAddBudget,
  canEditBudget,
  canDeleteBudget,
}: {
  project: ProjectDetail
  overview: ProjectOverview
  backlog: BacklogEntry | null
  progress: ProjectProgressData | null
  progressError: string | null
  budget: ProjectBudgetSnapshot
  canAddBudget: boolean
  canEditBudget: boolean
  canDeleteBudget: boolean
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
              {budget.status ? <BudgetStatusBadge status={budget.status} /> : null}
            </span>
          }
          description={meta || undefined}
          actions={
            <>
              <Button variant="outline" nativeButton={false} render={<Link href={`/documents/certificates/new?project=${project.id}`} />}>
                Completion Certificate
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href={`/documents/letters/new?project=${project.id}`} />}>
                Letter
              </Button>
              <Button variant="outline" nativeButton={false} render={<Link href={`/documents/challans/new?project=${project.id}`} />}>
                Delivery Challan
              </Button>
            </>
          }
        />
      </div>

      <ProjectSummarySection
        project={project}
        overview={overview}
        backlog={backlog}
        progress={progress}
        progressError={progressError}
        budget={budget}
        canAddBudget={canAddBudget}
        canEditBudget={canEditBudget}
        canDeleteBudget={canDeleteBudget}
      />
    </div>
  )
}
