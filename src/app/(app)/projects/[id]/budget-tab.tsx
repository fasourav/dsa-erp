"use client"

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { deleteProjectBudgetLine } from "@/app/(app)/projects/[id]/budget-actions"
import { BudgetLineDialog } from "@/app/(app)/projects/[id]/budget-line-dialog"
import { BudgetStatusBadge } from "@/app/(app)/projects/budget-status-badge"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { DataList, type DataListMobileItem } from "@/components/data-list"
import { Money } from "@/components/money"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import {
  budgetStatusLabel,
  type BudgetCategory,
  type BudgetLineView,
  type ProjectBudgetSnapshot,
} from "@/lib/project-budget-model"
import { cn } from "@/lib/utils"

type ColumnId = "category" | "planned" | "committed" | "actual" | "remaining" | "status"

const columns: readonly ListColumn<ColumnId>[] = [
  { id: "category", label: "Category", align: "left", locked: true },
  { id: "planned", label: "Planned", align: "right", locked: true },
  { id: "committed", label: "Committed", align: "right", locked: true },
  { id: "actual", label: "Actual", align: "right", locked: true },
  { id: "remaining", label: "Remaining", align: "right", locked: true },
  { id: "status", label: "Status", align: "left", locked: true },
]

export function BudgetTab({
  projectId,
  budget,
  categories,
  canAdd,
  canEdit,
  canDelete,
}: {
  projectId: string
  budget: ProjectBudgetSnapshot
  categories: readonly BudgetCategory[]
  canAdd: boolean
  canEdit: boolean
  canDelete: boolean
}) {
  const [sort, setSort] = useState<SortState<ColumnId>>({
    key: "category",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formLine, setFormLine] = useState<BudgetLineView | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<BudgetLineView | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const usedCategoryIds = new Set(
    budget.lines.flatMap((line) => (line.lineId && line.categoryId ? [line.categoryId] : [])),
  )
  const availableCategories = categories.filter(
    (category) => !usedCategoryIds.has(category.id) || category.id === formLine?.categoryId,
  )

  const sorted = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1
    return [...budget.lines].sort(
      (left, right) => compare(sortValue(left, sort.key), sortValue(right, sort.key)) * direction,
    )
  }, [budget.lines, sort])
  const pageResult = useMemo(() => paginateRows(sorted, page), [page, sorted])

  function openForm(line: BudgetLineView | null) {
    setFormLine(line)
    setFormSession((value) => value + 1)
    setFormOpen(true)
  }

  function askDelete(line: BudgetLineView) {
    setPendingDelete(line)
    setDeleteError(null)
    setDeleteOpen(true)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 md:px-0">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-panel-title font-bold md:font-strong">Budget</h2>
          <p className="text-caption text-muted-foreground">
            Actual includes vendor bills and project expenses. Committed is the open purchase order
            amount that is not yet billed. A line turns yellow at 90% and red when actual is over
            planned. Saving a bill is not blocked.
          </p>
        </div>
        {canAdd ? (
          <Button type="button" onClick={() => openForm(null)}>
            <Plus aria-hidden="true" data-icon="inline-start" />
            Add Budget Line
          </Button>
        ) : null}
      </div>

      {budget.error ? (
        <p role="alert" className="text-sm text-destructive">
          {budget.error}
        </p>
      ) : null}

      {budget.status === "over" ? (
        <p className="rounded-card bg-destructive-tint px-3 py-2 text-sm text-destructive">
          Actual is over the planned budget.
        </p>
      ) : budget.status === "warning" ? (
        <p className="rounded-card bg-warning-tint px-3 py-2 text-sm text-warning">
          Actual is at least 90% of the planned budget.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        <Total label="Planned" value={budget.totals.planned} />
        <Total label="Committed" value={budget.totals.committed} />
        <Total label="Actual" value={budget.totals.actual} />
        <Total
          label="Remaining"
          value={budget.totals.remaining}
          className={budget.totals.remaining < 0 ? "text-destructive" : undefined}
        />
      </div>

      <DataList
        columns={columns}
        rows={pageResult.rows}
        rowKey={(line) => line.key}
        sort={sort}
        onSort={(id) => {
          setSort((current) => toggleSort(current, id))
          setPage(1)
        }}
        visibility={{}}
        error={null}
        emptyMessage="No Budget Lines Yet."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          pageResult.total,
          "line",
          "lines",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Budget lines pagination"
        mobileItem={(line) => mobileLine(line)}
        renderCell={(line, columnId) => <LineCell line={line} columnId={columnId} />}
        renderActions={
          canEdit || canDelete
            ? (line) =>
                line.lineId ? (
                  <LineActions
                    line={line}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    onEdit={() => openForm(line)}
                    onDelete={() => askDelete(line)}
                  />
                ) : null
            : undefined
        }
      />

      <BudgetLineDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        projectId={projectId}
        line={formLine}
        categories={formLine ? availableCategories : categories.filter((category) => !usedCategoryIds.has(category.id))}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Budget Line"
        itemName={pendingDelete?.categoryName}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.lineId ?? "budget-line"}
        onConfirm={() => {
          if (!pendingDelete?.lineId) return
          setDeleteError(null)
          startDelete(async () => {
            const result = await deleteProjectBudgetLine(projectId, pendingDelete.lineId!)
            if (result.error) {
              setDeleteError(result.error)
              return
            }
            setDeleteOpen(false)
          })
        }}
      />
    </div>
  )
}

function Total({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <Card size="sm" className="min-w-0 gap-1">
      <CardContent className="flex min-w-0 flex-col gap-1">
        <p className="text-caption text-muted-foreground">{label}</p>
        <p className={cn("min-w-0 truncate text-metric", className)}>
          <Money value={value} />
        </p>
      </CardContent>
    </Card>
  )
}

function LineCell({ line, columnId }: { line: BudgetLineView; columnId: ColumnId }) {
  switch (columnId) {
    case "category":
      return (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{line.categoryName}</span>
          {line.notes ? (
            <span className="truncate text-caption text-muted-foreground">{line.notes}</span>
          ) : null}
        </span>
      )
    case "planned":
      return <Money value={line.planned} />
    case "committed":
      return <Money value={line.committed} />
    case "actual":
      return <Money value={line.actual} />
    case "remaining":
      return (
        <Money
          value={line.remaining}
          className={line.remaining < 0 ? "text-destructive" : undefined}
        />
      )
    case "status":
      return line.status === "ok" ? (
        <span className="text-muted-foreground">{budgetStatusLabel(line.status)}</span>
      ) : (
        <BudgetStatusBadge status={line.status} />
      )
  }
}

function mobileLine(line: BudgetLineView): DataListMobileItem {
  return {
    title: line.categoryName,
    value: <BudgetStatusBadge status={line.status} />,
    subtitle: line.notes || "Planned / Committed / Actual",
    meta: <Money value={line.remaining} />,
  }
}

function LineActions({
  line,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  line: BudgetLineView
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
            aria-label={`Actions for ${line.categoryName}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
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

function sortValue(line: BudgetLineView, key: ColumnId): string | number {
  switch (key) {
    case "category":
      return line.categoryName
    case "planned":
      return line.planned
    case "committed":
      return line.committed
    case "actual":
      return line.actual
    case "remaining":
      return line.remaining
    case "status":
      return budgetStatusLabel(line.status)
  }
}

function compare(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") return left - right
  return String(left).localeCompare(String(right), "en", { sensitivity: "base" })
}
