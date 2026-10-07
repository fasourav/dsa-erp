"use client"

import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FileText,
  LoaderCircle,
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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  isColumnVisible,
  isOptionalColumn,
  paginateProjects,
  paginationItems,
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

  const visibleColumns = dataColumns.filter((column) =>
    isColumnVisible(column.id, visibility),
  )
  const columnCount = visibleColumns.length + 1
  const sorted = useMemo(
    () => sortProjects(projects, sort),
    [projects, sort],
  )
  const pageResult = useMemo(
    () => paginateProjects(sorted, page),
    [sorted, page],
  )
  const pages = paginationItems(pageResult.currentPage, pageResult.pageCount)

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

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {visibleColumns.map((column) => {
                const active = sort.key === column.id
                return (
                  <TableHead
                    key={column.id}
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={cn(
                      "px-3 text-sm",
                      column.align === "right" && "text-right",
                    )}
                  >
                    <div
                      className={cn(
                        "flex",
                        column.align === "right" && "justify-end",
                      )}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          "border-0",
                          column.align === "right" ? "-mr-2.5" : "-ml-2.5",
                        )}
                        aria-label={
                          active
                            ? `Sort by ${column.label}, ${sort.direction === "asc" ? "ascending" : "descending"}`
                            : `Sort by ${column.label}`
                        }
                        onClick={() => toggleSort(column.id)}
                      >
                        {column.label}
                      </Button>
                    </div>
                  </TableHead>
                )
              })}
              <TableHead className="sticky right-0 z-10 w-16 bg-muted px-3">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  role="alert"
                  className="px-3 py-8 text-center whitespace-normal text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : pageResult.rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  className="px-3 py-8 text-center whitespace-normal text-muted-foreground"
                >
                  No Projects Yet.
                </TableCell>
              </TableRow>
            ) : (
              pageResult.rows.map((project) => (
                <TableRow key={project.id} className="group">
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        "p-3 text-sm",
                        column.align === "right" && "text-right",
                      )}
                    >
                      <CellValue project={project} columnId={column.id} />
                    </TableCell>
                  ))}
                  <TableCell className="sticky right-0 z-10 w-16 bg-card p-3 text-sm group-hover:bg-muted">
                    <RowActions
                      project={project}
                      onEdit={openForm}
                      onDelete={askDelete}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {projectRangeLabel(
              pageResult.rangeStart,
              pageResult.rangeEnd,
              pageResult.total,
            )}
          </p>
          <Pagination
            aria-label="Projects pagination"
            className="mx-0 w-auto justify-start sm:justify-end"
          >
            <PaginationContent className="flex-wrap">
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pageResult.currentPage <= 1}
                  aria-label="Go to previous page"
                  onClick={() => setPage(pageResult.currentPage - 1)}
                >
                  <ChevronLeft aria-hidden="true" data-icon="inline-start" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
              </PaginationItem>
              {pages.map((item, index) =>
                item === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <Button
                      type="button"
                      variant={
                        item === pageResult.currentPage ? "outline" : "ghost"
                      }
                      size="icon"
                      aria-label={`Page ${item}`}
                      aria-current={
                        item === pageResult.currentPage ? "page" : undefined
                      }
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </Button>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pageResult.currentPage >= pageResult.pageCount}
                  aria-label="Go to next page"
                  onClick={() => setPage(pageResult.currentPage + 1)}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight aria-hidden="true" data-icon="inline-end" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

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
        <div className="flex min-w-[12rem] flex-col gap-1">
          <span
            className={cn(
              "font-medium",
              !project.name && "text-muted-foreground",
            )}
          >
            {project.name || "—"}
          </span>
          {(project.clientName || project.projectType) ? (
            <span className="inline-flex w-fit max-w-full items-center rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-xs text-muted-foreground opacity-70">
              <span className="truncate">
                {[project.clientName, project.projectType]
                  .filter(Boolean)
                  .join(" / ")}
              </span>
            </span>
          ) : null}
        </div>
      )
    case "clientName":
      return project.clientName ? (
        <span>{project.clientName}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
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
    case "projectType":
      return project.projectType ? (
        <span>{project.projectType}</span>
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
        variant="secondary"
        className={cn(pillClassName, "bg-muted text-muted-foreground")}
      >
        <LoaderCircle aria-hidden="true" />
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
