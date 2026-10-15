"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useAccess, useCan } from "@/components/access-provider"

import {
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

import { BudgetStatusBadge } from "@/app/(app)/projects/budget-status-badge"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { deleteProject } from "@/app/(app)/projects/actions"
import { ProjectFormDialog } from "@/app/(app)/projects/project-form-dialog"
import { DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
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
  getColumnServerSnapshot,
  getColumnSnapshot,
  subscribeColumnVisibility,
  writeColumnVisibility,
} from "@/lib/project-column-store"
import {
  dataColumns,
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
  const canAdd = useCan("projects", "add")
  const showFinancials = useAccess().showFinancials

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
  const [query, setQuery] = useState("")
  const [listFilter, setListFilter] = useState("all")
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
  const filterOptions = [
    { value: "all", label: "All Statuses" },
    { value: "active", label: "Active" },
    { value: "completed", label: "Completed" },
  ]
  const filtered = useMemo(
    () => filterRows(sorted, query, rowText, listFilter, (project) => project.status),
    [listFilter, query, sorted],
  )
  const pageResult = useMemo(
    () => paginateProjects(filtered, page),
    [filtered, page],
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
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Projects"
        className="mb-0 md:mb-2"
        actions={
        <>
          <ListExport
            grid={{
              filename: "projects",
              title: "Projects",
              columns: [
                { header: "Project Name", kind: "text" },
                { header: "Client", kind: "text" },
                { header: "Location", kind: "text" },
                { header: "Date", kind: "text" },
                { header: "Status", kind: "text" },
                { header: "Phase", kind: "text" },
                { header: "% Complete", kind: "text" },
                { header: "Overdue Milestones", kind: "text" },
                { header: "Project Value", kind: "money" },
                { header: "Total Paid", kind: "money" },
                { header: "Total Due", kind: "money" },
                { header: "Expense", kind: "money" },
                { header: "Expense Due", kind: "money" },
                { header: "Gross Profit", kind: "money" },
              ],
              rows: filtered.map((project) => [
                project.name,
                project.clientName,
                project.location,
                formatProjectDate(project.startedOn),
                statusLabel(project.status),
                project.phase || "—",
                `${project.progressPercent}%`,
                project.overdueMilestones > 0 ? String(project.overdueMilestones) : "",
                showFinancials ? project.totalValue : "Hidden",
                showFinancials ? project.totalPaid : "Hidden",
                showFinancials ? project.totalDue : "Hidden",
                showFinancials ? project.expenseTotal : "Hidden",
                showFinancials ? project.expenseDue : "Hidden",
                showFinancials ? project.grossProfit : "Hidden",
              ]),
            }}
          />
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
          {canAdd ? (
          <Button type="button" onClick={() => openForm(null)}>
            <Plus aria-hidden="true" data-icon="inline-start" />
            Add New Project
          </Button>
          ) : null}
        </>
        }
      />

      <ListSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        placeholder="Search projects"
        filterLabel="Status"
        filter={listFilter}
        onFilterChange={(value) => {
          setListFilter(value)
          setPage(1)
        }}
        options={filterOptions}
      />
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
        mobileItem={(project) => ({
          title: (
            <Link
              href={`/projects/${project.id}`}
              className="block truncate underline-offset-4 hover:underline"
            >
              {project.name || "—"}
            </Link>
          ),
          value: (
            <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
              <StatusBadge status={project.status} />
              {project.budgetStatus ? <BudgetStatusBadge status={project.budgetStatus} /> : null}
            </span>
          ),
          subtitle: [
            project.location,
            project.phase,
            `${project.progressPercent}%`,
            project.overdueMilestones > 0 ? "Overdue" : "",
          ]
            .filter(Boolean)
            .join(" · "),
          meta: <Money value={project.totalValue} />,
        })}
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

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete Project"
        itemName={pendingDelete?.name}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
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
  const showFinancials = useAccess().showFinancials
  if (
    !showFinancials &&
    (columnId === "totalPaid" ||
      columnId === "totalDue" ||
      columnId === "expenseTotal" ||
      columnId === "expenseDue" ||
      columnId === "grossProfit")
  ) {
    return <span className="text-muted-foreground">Hidden</span>
  }

  switch (columnId) {
    case "name":
      return (
        <span className="inline-flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="link"
            nativeButton={false}
            render={<Link href={`/projects/${project.id}`} />}
            className={cn(
              "h-auto min-h-8 px-0 text-ui font-semibold text-foreground",
              !project.name && "text-muted-foreground",
            )}
          >
            {project.name || "—"}
          </Button>
          {project.overdueMilestones > 0 ? (
            <Badge variant="destructive">
              {project.overdueMilestones === 1
                ? "Overdue"
                : `${project.overdueMilestones} Overdue`}
            </Badge>
          ) : null}
        </span>
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
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusBadge status={project.status} />
          {project.budgetStatus ? <BudgetStatusBadge status={project.budgetStatus} /> : null}
        </span>
      )
    case "phase":
      return project.phase ? (
        <Badge variant="neutral">{project.phase}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "progressPercent":
      return <span className="tabular-nums">{project.progressPercent}%</span>
    case "totalValue":
      return <Money value={project.totalValue} />
    case "totalPaid":
      return (
        <Money
          value={project.totalPaid}
          className={project.totalPaid > 0 ? "text-success" : "text-muted-foreground"}
        />
      )
    case "totalDue":
      return (
        <Money
          value={project.totalDue}
          className={project.totalDue > 0 ? "text-destructive" : "text-muted-foreground"}
        />
      )
    case "expenseTotal":
      return <Money value={project.expenseTotal} />
    case "expenseDue":
      return <Money value={project.expenseDue} />
    case "grossProfit":
      return (
        <Money
          value={project.grossProfit}
          className={
            project.grossProfit > 0
              ? "text-success"
              : project.grossProfit < 0
                ? "text-destructive"
                : "text-muted-foreground"
          }
        />
      )
  }
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
  const canEdit = useCan("projects", "edit")
  const canDelete = useCan("projects", "delete")
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
        {canEdit ? (<DropdownMenuItem onClick={() => onEdit(project)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>) : null}
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
          Purchase Orders
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {canDelete ? (<DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(project)}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
