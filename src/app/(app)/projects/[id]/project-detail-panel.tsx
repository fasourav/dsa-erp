"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { ProjectSummarySection } from "@/app/(app)/projects/[id]/project-summary-section"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatExactBdt } from "@/lib/dashboard-metrics"
import { formatIsoDate } from "@/lib/format"
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
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={<Link href="/projects" aria-label="Back to projects" />}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-medium tracking-tight">{project.name}</h1>
            <StatusBadge status={project.status} />
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span>{project.clientName || "—"}</span>
            {project.projectType ? <span>{project.projectType}</span> : null}
            {project.location ? <span>{project.location}</span> : null}
          </p>
        </div>
      </div>

      <ProjectSummarySection projectId={project.id} overview={overview} />

      <Card>
        <CardHeader>
          <CardTitle>Project Info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {project.currentPhase ? (
            <InfoRow label="Phase" value={project.currentPhase} />
          ) : null}
          <InfoRow
            label="Started On"
            value={project.startedOn ? formatIsoDate(project.startedOn) : ""}
          />
          {project.completedOn ? (
            <InfoRow label="Completed On" value={formatIsoDate(project.completedOn)} />
          ) : null}
          {project.details ? (
            <div>
              <span className="text-muted-foreground">Details</span>
              <p className="mt-1 whitespace-pre-wrap">{project.details}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {backlog ? (
        <Card>
          <CardHeader>
            <CardTitle>Backlog</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <InfoRow label="Project Value" value={formatExactBdt(backlog.projectValue)} />
            <InfoRow label="Backlog Amount" value={formatExactBdt(backlog.backlogAmount)} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  )
}
