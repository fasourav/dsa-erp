"use client"

import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { deleteBudget } from "@/app/(app)/accounts/budgets/actions"
import { BudgetFormDialog } from "@/app/(app)/accounts/budgets/budget-form-dialog"
import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
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
import {
  paginateRows,
  paginationItems,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { formatMoney } from "@/lib/format"
import type { BudgetRow, DepartmentOption } from "@/lib/budgets"
import { cn } from "@/lib/utils"

const monthNames = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

type ColId = "department" | "period" | "allocatedBudget" | "actualSpent" | "variance"

const columns: { id: ColId; label: string; align: "left" | "right" }[] = [
  { id: "department", label: "Department", align: "left" },
  { id: "period", label: "Period", align: "left" },
  { id: "allocatedBudget", label: "Allocated", align: "right" },
  { id: "actualSpent", label: "Actual Spent", align: "right" },
  { id: "variance", label: "Variance", align: "right" },
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

export function BudgetsTable({
  budgets,
  departments,
  error,
}: {
  budgets: BudgetRow[]
  departments: DepartmentOption[]
  error: string | null
}) {
  const [sort, setSort] = useState<SortState<ColId>>({
    key: "period",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formBudget, setFormBudget] = useState<BudgetRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<BudgetRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(() => sortBudgets(budgets, sort), [budgets, sort])
  const pageResult = useMemo(() => paginateRows(sorted, page), [sorted, page])
  const pages = paginationItems(pageResult.currentPage, pageResult.pageCount)

  function openForm(budget: BudgetRow | null) {
    setFormBudget(budget)
    setFormSession((s) => s + 1)
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Budgets</h1>
        <Button type="button" onClick={() => openForm(null)}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add New Budget
        </Button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {columns.map((col) => {
                const active = sort.key === col.id
                return (
                  <TableHead key={col.id} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"} className={cn(col.align === "right" && "text-right")}>
                    <div className={cn("flex", col.align === "right" && "justify-end")}>
                      <Button type="button" variant="ghost" className={cn(col.align === "right" ? "-mr-2" : "-ml-2")} onClick={() => { setSort(toggleSort(sort, col.id)); setPage(1) }}>
                        {col.label}
                      </Button>
                    </div>
                  </TableHead>
                )
              })}
              <TableHead className="sticky right-0 z-10 w-16 bg-muted">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length + 1} role="alert" className="py-8 text-center whitespace-normal text-destructive">{error}</TableCell>
              </TableRow>
            ) : pageResult.rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length + 1} className="py-8 text-center whitespace-normal text-muted-foreground">No Budgets Yet.</TableCell>
              </TableRow>
            ) : (
              pageResult.rows.map((b) => (
                <TableRow key={b.id} className="group">
                  <TableCell className="font-medium">{b.department || "—"}</TableCell>
                  <TableCell>{monthNames[b.periodMonth]} {b.periodYear}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(b.allocatedBudget)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(b.actualSpent)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", b.variance < 0 && "text-destructive")}>
                    {formatMoney(b.variance)}
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 w-16 bg-card group-hover:bg-muted">
                    <DropdownMenu>
                      <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${b.department} budget`} />}>
                        <MoreHorizontal aria-hidden="true" className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openForm(b)}><Pencil aria-hidden="true" />Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => askDelete(b)}><Trash2 aria-hidden="true" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {rangeLabel(pageResult.rangeStart, pageResult.rangeEnd, pageResult.total, "budget", "budgets")}
          </p>
          <Pagination aria-label="Budgets pagination" className="mx-0 w-auto justify-start sm:justify-end">
            <PaginationContent className="flex-wrap">
              <PaginationItem>
                <Button type="button" variant="ghost" disabled={pageResult.currentPage <= 1} aria-label="Go to previous page" onClick={() => setPage(pageResult.currentPage - 1)}>
                  <ChevronLeft aria-hidden="true" data-icon="inline-start" /><span className="hidden sm:inline">Previous</span>
                </Button>
              </PaginationItem>
              {pages.map((item, index) =>
                item === "ellipsis" ? (<PaginationItem key={`ellipsis-${index}`}><PaginationEllipsis /></PaginationItem>) : (
                  <PaginationItem key={item}><Button type="button" variant={item === pageResult.currentPage ? "outline" : "ghost"} size="icon" aria-label={`Page ${item}`} aria-current={item === pageResult.currentPage ? "page" : undefined} onClick={() => setPage(item)}>{item}</Button></PaginationItem>
                ),
              )}
              <PaginationItem>
                <Button type="button" variant="ghost" disabled={pageResult.currentPage >= pageResult.pageCount} aria-label="Go to next page" onClick={() => setPage(pageResult.currentPage + 1)}>
                  <span className="hidden sm:inline">Next</span><ChevronRight aria-hidden="true" data-icon="inline-end" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      <BudgetFormDialog key={formSession} open={formOpen} onOpenChange={setFormOpen} budget={formBudget} departments={departments} />

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (open || deleting) return; setDeleteOpen(false); setDeleteError(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget</AlertDialogTitle>
            <AlertDialogDescription>Are you sure to delete this item? If yes, Press and Hold</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p role="alert" className="text-sm text-destructive">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={deleting}>Cancel</AlertDialogCancel>
            <HoldToDeleteButton key={pendingDelete?.id} pending={deleting} onConfirm={confirmDelete} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
