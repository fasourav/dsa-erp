"use client"

import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { MilestoneFormDialog } from "@/app/(app)/projects/[id]/milestone-form-dialog"
import {
  createStagesFromTemplate,
  deleteProjectMilestone,
  deleteProjectStage,
  importWorkOrderMilestones,
  moveProjectStage,
  setMilestoneDone,
} from "@/app/(app)/projects/[id]/progress-actions"
import { StageFormDialog } from "@/app/(app)/projects/[id]/stage-form-dialog"
import { useCan } from "@/components/access-provider"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyTitle } from "@/components/ui/empty"
import { formatIsoDate } from "@/lib/format"
import type { ListColumn, SortState } from "@/lib/list-paging"
import { toggleSort } from "@/lib/list-paging"
import {
  isOverdueMilestone,
  weightTotal,
  type ProjectMilestone,
  type ProjectProgressData,
  type ProjectStage,
} from "@/lib/project-progress"
import { savedToast } from "@/lib/saved"
import { cn } from "@/lib/utils"

type StageColumn = "name" | "weight" | "status" | "planned" | "doneOn"
type MilestoneColumn = "label" | "dueOn" | "amount" | "status"

const stageColumns: readonly ListColumn<StageColumn>[] = [
  { id: "name", label: "Stage", align: "left", locked: true },
  { id: "weight", label: "Weight", align: "right", locked: true },
  { id: "status", label: "Status", align: "left", locked: true },
  { id: "planned", label: "Planned", align: "left", locked: true },
  { id: "doneOn", label: "Done On", align: "left", locked: true },
]

const milestoneColumns: readonly ListColumn<MilestoneColumn>[] = [
  { id: "label", label: "Milestone", align: "left", locked: true },
  { id: "dueOn", label: "Due On", align: "left", locked: true },
  { id: "amount", label: "Amount", align: "right", locked: true },
  { id: "status", label: "Status", align: "left", locked: true },
]

export function ProjectProgressPanel({
  projectId,
  progress,
  error,
}: {
  projectId: string
  progress: ProjectProgressData | null
  error: string | null
}) {
  const router = useRouter()
  const canAddStage = useStageAllowed("add")
  const canEditStage = useStageAllowed("edit")
  const canDeleteStage = useStageAllowed("delete")
  const canAdd = useEitherAllowed("add")
  const canEdit = useEitherAllowed("edit")
  const canDelete = useEitherAllowed("delete")
  const [stageSort, setStageSort] = useState<SortState<StageColumn>>({
    key: "name",
    direction: "asc",
  })
  const [stageSortActive, setStageSortActive] = useState(false)
  const [stagePage, setStagePage] = useState(1)
  const [milestoneSort, setMilestoneSort] = useState<SortState<MilestoneColumn>>({
    key: "dueOn",
    direction: "asc",
  })
  const [milestonePage, setMilestonePage] = useState(1)
  const [stageOpen, setStageOpen] = useState(false)
  const [stageSession, setStageSession] = useState(0)
  const [editingStage, setEditingStage] = useState<ProjectStage | null>(null)
  const [milestoneOpen, setMilestoneOpen] = useState(false)
  const [milestoneSession, setMilestoneSession] = useState(0)
  const [editingMilestone, setEditingMilestone] = useState<ProjectMilestone | null>(null)
  const [pendingDelete, setPendingDelete] = useState<
    { kind: "stage" | "milestone"; id: string; name: string } | null
  >(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pending, startAction] = useTransition()

  const percent = progress?.progressPercent ?? 0
  const barWidth = Math.min(100, Math.max(0, percent))
  const sortedStages = useMemo(() => {
    const stages = progress?.stages ?? []
    return stageSortActive ? sortStages(stages, stageSort) : stages
  }, [progress?.stages, stageSort, stageSortActive])
  const stagePages = pageOf(sortedStages, stagePage)
  const sortedMilestones = useMemo(
    () => sortMilestones(progress?.milestones ?? [], milestoneSort),
    [milestoneSort, progress?.milestones],
  )
  const milestonePages = pageOf(sortedMilestones, milestonePage)
  const stages = progress?.stages ?? []

  function run(action: () => Promise<{ error: string | null }>, message: string) {
    setActionError(null)
    startAction(async () => {
      const result = await action()
      if (result.error) {
        setActionError(result.error)
        return
      }
      savedToast(message)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="flex flex-col gap-3 rounded-card glass-panel px-4 py-4 md:px-6 md:py-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-label text-muted-foreground">% Complete</p>
          <p className="text-ui font-semibold tabular-nums">{formatPercent(percent)}</p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-fill-strong"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(barWidth)}
          aria-label="Project completion"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${barWidth}%` }} />
        </div>
        <p className="text-caption text-muted-foreground">
          Stage Weights Total {formatPercent(weightTotal(stages))}
        </p>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {stages.length === 0 ? (
        <Empty>
          <EmptyTitle>No Stages Yet</EmptyTitle>
          {canAddStage ? (
            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => createStagesFromTemplate(projectId), "Stages created.")
                }
              >
                Use Default Stages
              </Button>
              <Button type="button" variant="outline" onClick={() => openStage(null)}>
                Add Stage
              </Button>
            </div>
          ) : null}
        </Empty>
      ) : (
        <DataList
          columns={stageColumns}
          rows={stagePages.rows}
          rowKey={(stage) => stage.id}
          sort={stageSort}
          onSort={(key) => {
            setStageSortActive(true)
            setStageSort((current) => toggleSort(current, key))
            setStagePage(1)
          }}
          visibility={{}}
          error={null}
          emptyMessage="No Stages Yet."
          rangeText={countLabel(stagePages, "stage", "stages")}
          currentPage={stagePages.currentPage}
          pageCount={stagePages.pageCount}
          onPageChange={setStagePage}
          pagingLabel="Stage pagination"
          toolbar={
            canAddStage ? (
              <Button type="button" onClick={() => openStage(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add Stage
              </Button>
            ) : null
          }
          mobileItem={(stage) => ({
            title: stage.name,
            subtitle: stageDates(stage),
            meta: <Badge variant={statusVariant(stage.status)}>{stage.status}</Badge>,
          })}
          renderCell={(stage, columnId) => <StageCell stage={stage} columnId={columnId} />}
          renderActions={
            canEditStage || canDeleteStage
              ? (stage) => (
                  <StageActions
                    stage={stage}
                    canEdit={canEditStage}
                    canDelete={canDeleteStage}
                    pending={pending}
                    onEdit={() => openStage(stage)}
                    onMove={(direction) =>
                      run(
                        () => moveProjectStage(projectId, stage.id, direction),
                        "Stage moved.",
                      )
                    }
                    onDelete={() => askDelete("stage", stage.id, stage.name)}
                  />
                )
              : undefined
          }
        />
      )}

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 md:px-0">
          <h2 className="text-panel-title font-bold md:font-strong">Milestones</h2>
          <div className="flex flex-wrap gap-2">
            {canAdd ? (
              <Button
                type="button"
                variant="outline"
                className="h-auto whitespace-normal"
                disabled={pending}
                onClick={() =>
                  run(() => importWorkOrderMilestones(projectId), "Milestones imported.")
                }
              >
                Import Milestones From Work Order
              </Button>
            ) : null}
            {canAdd ? (
              <Button type="button" onClick={() => openMilestone(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add Milestone
              </Button>
            ) : null}
          </div>
        </div>
        <DataList
          columns={milestoneColumns}
          rows={milestonePages.rows}
          rowKey={(milestone) => milestone.id}
          sort={milestoneSort}
          onSort={(key) => {
            setMilestoneSort((current) => toggleSort(current, key))
            setMilestonePage(1)
          }}
          visibility={{}}
          error={null}
          emptyMessage="No Milestones Yet."
          rangeText={countLabel(milestonePages, "milestone", "milestones")}
          currentPage={milestonePages.currentPage}
          pageCount={milestonePages.pageCount}
          onPageChange={setMilestonePage}
          pagingLabel="Milestone pagination"
          mobileItem={(milestone) => ({
            title: milestone.label,
            subtitle: milestone.dueOn ? formatIsoDate(milestone.dueOn) : "No Due Date",
            meta: milestoneMeta(milestone),
          })}
          renderCell={(milestone, columnId) => (
            <MilestoneCell
              milestone={milestone}
              columnId={columnId}
              canEdit={canEdit}
              pending={pending}
              onToggle={(done) =>
                run(
                  () => setMilestoneDone(projectId, milestone.id, done),
                  done ? "Milestone done." : "Milestone reopened.",
                )
              }
            />
          )}
          renderActions={
            canEdit || canDelete
              ? (milestone) => (
                  <MilestoneActions
                    milestone={milestone}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={() => openMilestone(milestone)}
                    onDelete={() => askDelete("milestone", milestone.id, milestone.label)}
                  />
                )
              : undefined
          }
        />
      </div>

      <StageFormDialog
        key={`stage-${stageSession}`}
        open={stageOpen}
        onOpenChange={setStageOpen}
        projectId={projectId}
        stage={editingStage}
      />
      <MilestoneFormDialog
        key={`milestone-${milestoneSession}`}
        open={milestoneOpen}
        onOpenChange={setMilestoneOpen}
        projectId={projectId}
        milestone={editingMilestone}
        stages={stages}
      />
      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (open || pending) return
          setPendingDelete(null)
          setDeleteError(null)
        }}
        title={pendingDelete?.kind === "milestone" ? "Delete Milestone" : "Delete Stage"}
        itemName={pendingDelete?.name}
        error={deleteError}
        pending={pending}
        confirmKey={pendingDelete?.id}
        onConfirm={() => {
          if (!pendingDelete) return
          const target = pendingDelete
          startAction(async () => {
            const result =
              target.kind === "stage"
                ? await deleteProjectStage(projectId, target.id)
                : await deleteProjectMilestone(projectId, target.id)
            if (result.error) {
              setDeleteError(result.error)
              return
            }
            setPendingDelete(null)
            setDeleteError(null)
            savedToast("Deleted.")
            router.refresh()
          })
        }}
      />
    </div>
  )

  function openStage(stage: ProjectStage | null) {
    setEditingStage(stage)
    setStageSession((current) => current + 1)
    setStageOpen(true)
  }

  function openMilestone(milestone: ProjectMilestone | null) {
    setEditingMilestone(milestone)
    setMilestoneSession((current) => current + 1)
    setMilestoneOpen(true)
  }

  function askDelete(kind: "stage" | "milestone", id: string, name: string) {
    setDeleteError(null)
    setPendingDelete({ kind, id, name })
  }
}

function useEitherAllowed(action: "view" | "add" | "edit" | "delete") {
  const progress = useCan("project_progress", action)
  const projects = useCan("projects", action)
  return progress || projects
}

function useStageAllowed(action: "view" | "add" | "edit" | "delete") {
  const allowed = useEitherAllowed(action)
  const projectsEdit = useCan("projects", "edit")
  return allowed && projectsEdit
}

function StageCell({ stage, columnId }: { stage: ProjectStage; columnId: StageColumn }) {
  switch (columnId) {
    case "name":
      return stage.name
    case "weight":
      return <span className="tabular-nums">{formatPercent(stage.weight)}</span>
    case "status":
      return <Badge variant={statusVariant(stage.status)}>{stage.status}</Badge>
    case "planned":
      return stage.plannedStart || stage.plannedEnd ? (
        stageDates(stage)
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "doneOn":
      return stage.doneOn ? (
        formatIsoDate(stage.doneOn)
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}

function MilestoneCell({
  milestone,
  columnId,
  canEdit,
  pending,
  onToggle,
}: {
  milestone: ProjectMilestone
  columnId: MilestoneColumn
  canEdit: boolean
  pending: boolean
  onToggle: (done: boolean) => void
}) {
  const overdue = isOverdueMilestone(milestone)
  switch (columnId) {
    case "label":
      return (
        <span className="flex items-center gap-2.5">
          <Checkbox
            checked={Boolean(milestone.doneOn)}
            disabled={!canEdit || pending}
            aria-label={`Mark ${milestone.label} done`}
            onCheckedChange={(checked) => onToggle(checked === true)}
          />
          <span className={cn(milestone.doneOn && "text-muted-foreground")}>{milestone.label}</span>
          {milestone.workOrderMilestoneId ? <Badge variant="outline">Work Order</Badge> : null}
        </span>
      )
    case "dueOn":
      return milestone.dueOn ? (
        formatIsoDate(milestone.dueOn)
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "amount":
      return milestone.amount === null ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <Money value={milestone.amount} />
      )
    case "status":
      if (milestone.doneOn) return <Badge variant="success">Done</Badge>
      if (overdue) return <Badge variant="destructive">Overdue</Badge>
      return <Badge variant="neutral">Open</Badge>
  }
}

function StageActions({
  stage,
  canEdit,
  canDelete,
  pending,
  onEdit,
  onMove,
  onDelete,
}: {
  stage: ProjectStage
  canEdit: boolean
  canDelete: boolean
  pending: boolean
  onEdit: () => void
  onMove: (direction: "up" | "down") => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${stage.name}`} />
        }
      >
        <span className="sr-only">Actions</span>
        <ChevronDown aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {canEdit ? (
          <DropdownMenuItem disabled={pending} onClick={() => onMove("up")}>
            <ChevronUp aria-hidden="true" />
            Move Up
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <DropdownMenuItem disabled={pending} onClick={() => onMove("down")}>
            <ChevronDown aria-hidden="true" />
            Move Down
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil aria-hidden="true" />
            Edit
          </DropdownMenuItem>
        ) : null}
        {canDelete ? <DropdownMenuSeparator /> : null}
        {canDelete ? (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MilestoneActions({
  milestone,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  milestone: ProjectMilestone
  canEdit: boolean
  canDelete: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${milestone.label}`}
          />
        }
      >
        <ChevronDown aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {canEdit ? (
          <DropdownMenuItem onClick={onEdit}>
            <Pencil aria-hidden="true" />
            Edit
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function milestoneMeta(milestone: ProjectMilestone) {
  if (milestone.doneOn) return <Badge variant="success">Done</Badge>
  if (isOverdueMilestone(milestone)) return <Badge variant="destructive">Overdue</Badge>
  if (milestone.amount !== null) return <Money value={milestone.amount} />
  return null
}

function stageDates(stage: ProjectStage) {
  const start = stage.plannedStart ? formatIsoDate(stage.plannedStart) : ""
  const end = stage.plannedEnd ? formatIsoDate(stage.plannedEnd) : ""
  return [start, end].filter(Boolean).join(" – ")
}

function statusVariant(status: ProjectStage["status"]) {
  if (status === "Done") return "success" as const
  if (status === "In Progress") return "info" as const
  return "neutral" as const
}

function formatPercent(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`
}

function sortStages(stages: readonly ProjectStage[], sort: SortState<StageColumn>) {
  const direction = sort.direction === "asc" ? 1 : -1
  return [...stages].sort((left, right) => {
    const primary = compareStage(left, right, sort.key) * direction
    if (primary !== 0) return primary
    return left.sortOrder - right.sortOrder
  })
}

function compareStage(left: ProjectStage, right: ProjectStage, key: StageColumn) {
  switch (key) {
    case "name":
      return left.name.localeCompare(right.name, "en", { sensitivity: "base" })
    case "weight":
      return left.weight - right.weight
    case "status":
      return left.status.localeCompare(right.status, "en")
    case "planned":
      return (left.plannedStart || left.plannedEnd).localeCompare(
        right.plannedStart || right.plannedEnd,
      )
    case "doneOn":
      return left.doneOn.localeCompare(right.doneOn)
  }
}

function sortMilestones(
  milestones: readonly ProjectMilestone[],
  sort: SortState<MilestoneColumn>,
) {
  const direction = sort.direction === "asc" ? 1 : -1
  return [...milestones].sort((left, right) => {
    // Undated milestones always go last, whichever way the due date is sorted.
    if (sort.key === "dueOn" && !left.dueOn !== !right.dueOn) return left.dueOn ? -1 : 1
    const primary = compareMilestone(left, right, sort.key) * direction
    if (primary !== 0) return primary
    return left.label.localeCompare(right.label, "en", { sensitivity: "base" })
  })
}

function compareMilestone(
  left: ProjectMilestone,
  right: ProjectMilestone,
  key: MilestoneColumn,
) {
  switch (key) {
    case "label":
      return left.label.localeCompare(right.label, "en", { sensitivity: "base" })
    case "dueOn":
      return left.dueOn.localeCompare(right.dueOn)
    case "amount":
      return (left.amount ?? -1) - (right.amount ?? -1)
    case "status":
      return Number(Boolean(left.doneOn)) - Number(Boolean(right.doneOn))
  }
}

function pageOf<T>(rows: readonly T[], page: number) {
  const pageSize = 10
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const start = (currentPage - 1) * pageSize
  return {
    rows: rows.slice(start, start + pageSize),
    total,
    pageCount,
    currentPage,
    rangeStart: total === 0 ? 0 : start + 1,
    rangeEnd: Math.min(start + pageSize, total),
  }
}

function countLabel(
  page: { rangeStart: number; rangeEnd: number; total: number },
  singular: string,
  plural: string,
) {
  if (page.total === 0) return `0 ${plural}`
  const noun = page.total === 1 ? singular : plural
  if (page.rangeStart === page.rangeEnd) return `Showing ${page.rangeStart} of ${page.total} ${noun}`
  return `Showing ${page.rangeStart}–${page.rangeEnd} of ${page.total} ${noun}`
}
