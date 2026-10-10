"use client"

import {
  Check,
  ChevronDown,
  Columns3,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useSyncExternalStore, useTransition } from "react"

import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
import { deleteProject } from "@/app/(app)/projects/actions"
import { ProjectFormDialog } from "@/app/(app)/projects/project-form-dialog"
import { DataList } from "@/components/data-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { formatMoney } from "@/lib/format"
import {
  getColumnServerSnapshot,
  getColumnSnapshot,
  subscribeColumnVisibility,
  writeColumnVisibility,
} from "@/lib/project-column-store"
import {
  dataColumns,
  formatPercent,
  formatProjectDate,
  isOptionalColumn,
  paginateProjects,
  projectRangeLabel,
  sortProjects,
  statusLabel,
  type CatalogOption,
  type ClientOption,
  type ColumnId,
  type ProjectRow,
  type SortState,
} from "@/lib/project-summary"
import { cn } from "@/lib/utils"

export function ProjectsTable({
  projects,
  clients,
  projectTypes,
  projectPhases,
  error,
}: {
  projects: ProjectRow[]
  clients: ClientOption[]
  projectTypes: CatalogOption[]
  projectPhases: CatalogOption[]
  error: string | null
}) {
  const visibility = useSyncExternalStore(
    subscribeColumnVisibility,
    getColumnSnapshot,
    getColumnServerSnapshot,
  )
  const [sort, setSort] = useState<SortState>({
    key: "name",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formProject, setFormProject] = useState<ProjectRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ProjectRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(
    () => sortProjects(projects, sort),
    [projects, sort],
  )
  const pageResult = useMemo(
    () => paginateProjects(sorted, page),
    [sorted, page],
  )

  function toggleSort(key: ColumnId) {
    setSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        }
      }

      return { key, direction: "asc" }
    })
    setPage(1)
  }

  function openForm(project: ProjectRow | null) {
    setFormProject(project)
    setFormSession((current) => current + 1)
    setFormOpen(true)
  }

  function askDelete(project: ProjectRow) {
    setDeleteError(null)
    setPendingDelete(project)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteProject(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this project.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Projects</h1>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="outline" />}
            >
              <Columns3 aria-hidden="true" data-icon="inline-start" />
              Customize Columns
              <ChevronDown aria-hidden="true" data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {dataColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={
                    isOptionalColumn(column.id) ? visibility[column.id] : true
                  }
                  disabled={column.locked}
                  onCheckedChange={(checked) => {
                    if (!isOptionalColumn(column.id)) {
                      return
                    }

                    writeColumnVisibility({
                      ...visibility,
                      [column.id]: checked,
                    })
                  }}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus aria-hidden="true" data-icon="inline-start" />
            Add New Project
          </Button>
        </div>
      </div>

      <DataList
        columns={dataColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(project) => project.id}
        sort={sort}
        onSort={toggleSort}
        visibility={visibility}
        error={error}
        emptyMessage="No Projects Yet."
        rangeText={projectRangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Projects pagination"
        renderCell={(project, columnId) => (
          <CellValue project={project} columnId={columnId} />
        )}
        renderActions={(project) => (
          <RowActions
            project={project}
            onEdit={openForm}
            onDelete={askDelete}
          />
        )}
      />
      <ProjectFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        project={formProject}
        clients={clients}
        projectTypes={projectTypes}
        projectPhases={projectPhases}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure to delete this item? If yes, Press and Hold
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <HoldToDeleteButton
              key={pendingDelete?.id}
              pending={deleting}
              onConfirm={confirmDelete}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CellValue({
  project,
  columnId,
}: {
  project: ProjectRow
  columnId: ColumnId
}) {
  switch (columnId) {
    case "name":
      return (
        <div className="flex w-full min-w-0 flex-col gap-1">
          <Link
            href={`/projects/${project.id}`}
            className={cn(
              "font-medium underline underline-offset-4",
              !project.name && "text-muted-foreground",
            )}
          >
            {project.name || "—"}
          </Link>
          {(project.clientName || project.projectType) ? (
            <span className="inline-flex w-fit max-w-full items-center rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground opacity-90">
              <span className="truncate">
                {[project.clientName, project.projectType]
                  .filter(Boolean)
                  .join(" / ")}
              </span>
            </span>
          ) : null}
        </div>
      )
    case "location":
      return project.location ? (
        <span>{project.location}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "startedOn":
      return project.startedOn ? (
        <span>{formatProjectDate(project.startedOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "status":
      return <StatusValue status={project.status} />
    case "phase":
      return project.phase ? (
        <PhaseValue phase={project.phase} />
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "totalValue":
      return <MoneyValue value={project.totalValue} />
    case "totalPaid":
      return (
        <MoneyWithPercent
          amount={project.totalPaid}
          part={project.totalPaid}
          total={project.totalValue}
        />
      )
    case "totalDue":
      return <MoneyValue value={project.totalDue} />
    case "expenseTotal":
      return <MoneyValue value={project.expenseTotal} />
    case "expenseDue":
      return <MoneyValue value={project.expenseDue} />
    case "grossProfit":
      return (
        <MoneyWithPercent
          amount={project.grossProfit}
          part={project.grossProfit}
          total={project.totalValue}
        />
      )
  }
}

function MoneyValue({ value }: { value: number }) {
  return <span className="tabular-nums">{formatMoney(value)}</span>
}

function MoneyWithPercent({
  amount,
  part,
  total,
}: {
  amount: number
  part: number
  total: number
}) {
  return (
    <span className="flex flex-col items-end gap-0.5 leading-tight">
      <span className="tabular-nums">{formatMoney(amount)}</span>
      <span className="text-muted-foreground tabular-nums">
        {formatPercent(part, total)}
      </span>
    </span>
  )
}

const pillClassName =
  "h-7 gap-1.5 rounded-full px-2.5 text-sm font-medium"

function StatusValue({ status }: { status: ProjectRow["status"] }) {
  if (status === "active") {
    return (
      <Badge
        variant="outline"
        className={cn(
          pillClassName,
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        )}
      >
        {statusLabel(status)}
      </Badge>
    )
  }

  return (
    <Badge
      variant="secondary"
      className={cn(pillClassName, "bg-primary/10 text-primary")}
    >
      <Check aria-hidden="true" />
      {statusLabel(status)}
    </Badge>
  )
}

function PhaseValue({ phase }: { phase: string }) {
  return (
    <Badge variant="outline" className={cn(pillClassName, "bg-card")}>
      {phase}
    </Badge>
  )
}

function RowActions({
  project,
  onEdit,
  onDelete,
}: {
  project: ProjectRow
  onEdit: (project: ProjectRow) => void
  onDelete: (project: ProjectRow) => void
}) {
  const label = project.name || "project"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${label}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => onEdit(project)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          nativeButton={false}
          render={<Link href={`/accounts/invoices?project=${project.id}`} />}
        >
          <FileText aria-hidden="true" />
          Client Invoices
        </DropdownMenuItem>
        <DropdownMenuItem
          nativeButton={false}
          render={
            <Link href={`/purchase-orders?project=${project.id}`} />
          }
        >
          <Receipt aria-hidden="true" />
          Purchase orders
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(project)}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
