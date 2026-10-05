"use client"

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { deleteOperationalExpense } from "@/app/(app)/accounts/expenses/actions"
import { ExpenseFormDialog } from "@/app/(app)/accounts/expenses/expense-form-dialog"
import { CustomizeColumns, DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatIsoDate, formatMoney } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { expenseColumnStore } from "@/lib/operational-expense-column-store"
import {
  expenseColumns,
  sortExpenses,
  type ExpenseColumnId,
  type NamedOption,
  type OperationalExpenseRow,
} from "@/lib/operational-expenses"
import { useColumnVisibility } from "@/lib/use-column-visibility"

const locked = new Set<ExpenseColumnId>(["expenseDate", "category"])

export function ExpensesTable({
  expenses,
  categories,
  paymentMethods,
  projects,
  departments,
  error,
}: {
  expenses: OperationalExpenseRow[]
  categories: string[]
  paymentMethods: string[]
  projects: NamedOption[]
  departments: NamedOption[]
  error: string | null
}) {
  const visibility = useColumnVisibility(expenseColumnStore)
  const [sort, setSort] = useState<SortState<ExpenseColumnId>>({
    key: "expenseDate",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formExpense, setFormExpense] = useState<OperationalExpenseRow | null>(
    null,
  )
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<OperationalExpenseRow | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()
  const sorted = useMemo(() => sortExpenses(expenses, sort), [expenses, sort])
  const pageResult = paginateRows(sorted, page)

  function changeVisibility(id: ExpenseColumnId, checked: boolean) {
    if (locked.has(id)) {
      return
    }

    expenseColumnStore.write({ ...visibility, [id]: checked })
  }

  function openForm(expense: OperationalExpenseRow | null) {
    setFormExpense(expense)
    setFormSession((current) => current + 1)
    setFormOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteOperationalExpense(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this expense.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">
        Operational Expenses
      </h1>
      <DataList
        columns={expenseColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(expense) => expense.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
          setPage(1)
        }}
        visibility={visibility}
        error={error}
        emptyMessage="No operational expenses yet."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "expense",
          "expenses",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Operational Expenses pagination"
        toolbar={
          <>
            <CustomizeColumns
              columns={expenseColumns}
              visibility={visibility}
              onVisibilityChange={changeVisibility}
            />
            <Button type="button" onClick={() => openForm(null)}>
              <Plus aria-hidden="true" data-icon="inline-start" />
              Add expense
            </Button>
          </>
        }
        renderCell={(expense, columnId) => (
          <Cell expense={expense} columnId={columnId} />
        )}
        renderActions={(expense) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${expense.category || "expense"}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => openForm(expense)}>
                <Pencil aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setDeleteError(null)
                  setPendingDelete(expense)
                  setDeleteOpen(true)
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <ExpenseFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={formExpense}
        categories={categories}
        paymentMethods={paymentMethods}
        projects={projects}
        departments={departments}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete operational expense"
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function Cell({
  expense,
  columnId,
}: {
  expense: OperationalExpenseRow
  columnId: ExpenseColumnId
}) {
  switch (columnId) {
    case "expenseDate":
      return expense.expenseDate ? (
        <span>{formatIsoDate(expense.expenseDate)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "category":
      return <span className="font-medium">{expense.category || "—"}</span>
    case "amount":
      return <span className="tabular-nums">{formatMoney(expense.amount)}</span>
    case "paymentMethod":
      return expense.paymentMethod ? (
        <span>{expense.paymentMethod}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}
