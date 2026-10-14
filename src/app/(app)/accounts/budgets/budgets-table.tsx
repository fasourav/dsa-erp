"use client"

import { ListExport } from "@/components/list-export"
import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useCan } from "@/components/access-provider"

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { deleteBudget } from "@/app/(app)/accounts/budgets/actions"
import { BudgetFormDialog } from "@/app/(app)/accounts/budgets/budget-form-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import type { BudgetRow, DepartmentOption } from "@/lib/budgets"
import { cn } from "@/lib/utils"

const monthNames = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

type ColId = "department" | "period" | "allocatedBudget" | "actualSpent" | "variance"

const columns: readonly ListColumn<ColId>[] = [
  { id: "department", label: "Department", align: "left", locked: true },
  { id: "period", label: "Period", align: "left", locked: false },
  { id: "allocatedBudget", label: "Allocated", align: "right", locked: false },
  { id: "actualSpent", label: "Actual Spent", align: "right", locked: false },
  { id: "variance", label: "Variance", align: "right", locked: false },
]

function sortBudgets(rows: BudgetRow[], sort: SortState<ColId>): BudgetRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case "department":
        cmp = a.department.localeCompare(b.department, "en", { sensitivity: "base" })
        break
      case "period":
        cmp = a.periodYear - b.periodYear || a.periodMonth - b.periodMonth
        break
      case "allocatedBudget":
        cmp = a.allocatedBudget - b.allocatedBudget
        break
      case "actualSpent":
        cmp = a.actualSpent - b.actualSpent
        break
      case "variance":
        cmp = a.variance - b.variance
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })
  return sorted
}

function moneyClass(value: number) {
  if (value < 0) return "text-destructive"
  if (value > 0) return "text-success"
  return "text-muted-foreground"
}

export function BudgetsTable({
  budgets,
  departments,
  error,
}: {
  budgets: BudgetRow[]
  departments: DepartmentOption[]
  error: string | null
}) {
  const canAdd = useCan("budgets", "add")
  const canEdit = useCan("budgets", "edit")
  const canDelete = useCan("budgets", "delete")

  const [sort, setSort] = useState<SortState<ColId>>({
    key: "period",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [formBudget, setFormBudget] = useState<BudgetRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<BudgetRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(() => sortBudgets(budgets, sort), [budgets, sort])
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = useMemo(() => paginateRows(filtered, page), [filtered, page])
  const totals = useMemo(() => {
    const allocated = budgets.reduce((sum, row) => sum + row.allocatedBudget, 0)
    const spent = budgets.reduce((sum, row) => sum + row.actualSpent, 0)
    const variance = budgets.reduce((sum, row) => sum + row.variance, 0)
    return {
      allocated: Math.round(allocated * 100) / 100,
      spent: Math.round(spent * 100) / 100,
      variance: Math.round(variance * 100) / 100,
    }
  }, [budgets])

  function openForm(budget: BudgetRow | null) {
    setFormBudget(budget)
    setFormSession((session) => session + 1)
    setFormOpen(true)
  }

  function askDelete(budget: BudgetRow) {
    setDeleteError(null)
    setPendingDelete(budget)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteBudget(id)
        if (result.error) { setDeleteError(result.error); return }
        setDeleteOpen(false)
        setDeleteError(null)
      } catch { setDeleteError("Could not delete this budget.") }
    })
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Budgets"
        className="mb-0 md:mb-2"
        actions={
          <>
            <ListExport
              grid={{
                filename: "budgets",
                title: "Budgets",
                columns: [
                  { header: "Department", kind: "text" },
                  { header: "Period", kind: "text" },
                  { header: "Allocated", kind: "money" },
                  { header: "Actual Spent", kind: "money" },
                  { header: "Variance", kind: "money" },
                ],
                rows: filtered.map((budget) => [
                  budget.department,
                  `${monthNames[budget.periodMonth] ?? ""} ${budget.periodYear}`.trim(),
                  budget.allocatedBudget,
                  budget.actualSpent,
                  budget.variance,
                ]),
              }}
            />
            {canAdd ? (
              <Button type="button" onClick={() => openForm(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add New Budget
              </Button>
            ) : null}
          </>
        }
      />

      {error ? null : (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
          <Card size="sm">
            <CardContent className="flex flex-col gap-1">
              <p className="text-label font-semibold text-muted-foreground">Allocated</p>
              <p className="text-metric">
                <Money value={totals.allocated} />
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex flex-col gap-1">
              <p className="text-label font-semibold text-muted-foreground">Actual Spent</p>
              <p className="text-metric">
                <Money value={totals.spent} />
              </p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="flex flex-col gap-1">
              <p className="text-label font-semibold text-muted-foreground">Variance</p>
              <p className="text-metric">
                <Money value={totals.variance} className={moneyClass(totals.variance)} />
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <ListSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        placeholder="Search budgets"
      />
      <DataList
        columns={columns}
        rows={error ? [] : pageResult.rows}
        rowKey={(budget) => budget.id}
        sort={sort}
        onSort={(key) => {
          setSort(toggleSort(sort, key))
          setPage(1)
        }}
        visibility={{}}
        error={error}
        emptyMessage="No Budgets Yet."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "budget",
          "budgets",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Budgets pagination"
        mobileItem={(budget) => ({
          title: budget.department || "—",
          subtitle: (
            <>
              Allocated <Money value={budget.allocatedBudget} />
            </>
          ),
          meta: <Money value={budget.actualSpent} />,
        })}
        renderCell={(budget, columnId) => <Cell budget={budget} columnId={columnId} />}
        renderActions={(budget) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${budget.department} budget`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {canEdit ? (
                <DropdownMenuItem onClick={() => openForm(budget)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {canDelete ? (
                <DropdownMenuItem variant="destructive" onClick={() => askDelete(budget)}>
                  <Trash2 aria-hidden="true" />
                  Delete
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <BudgetFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        budget={formBudget}
        departments={departments}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen || deleting) return
          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete Budget"
        itemName={pendingDelete?.department}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function Cell({ budget, columnId }: { budget: BudgetRow; columnId: ColId }) {
  switch (columnId) {
    case "department":
      return (
        <span className={cn("text-ui font-semibold", !budget.department && "text-muted-foreground")}>
          {budget.department || "—"}
        </span>
      )
    case "period":
      return (
        <span>
          {monthNames[budget.periodMonth]} {budget.periodYear}
        </span>
      )
    case "allocatedBudget":
      return <Money value={budget.allocatedBudget} />
    case "actualSpent":
      return <Money value={budget.actualSpent} />
    case "variance":
      return <Money value={budget.variance} className={moneyClass(budget.variance)} />
  }
}
