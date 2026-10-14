"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useCan } from "@/components/access-provider"

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { deleteOperationalExpense } from "@/app/(app)/accounts/expenses/actions"
import { ExpenseFormDialog } from "@/app/(app)/accounts/expenses/expense-form-dialog"
import { DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BankAccountChoice } from "@/lib/bank-account"
import { formatDayMonYear, formatIsoDate } from "@/lib/format"
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
import { cn } from "@/lib/utils"

export function ExpensesTable({
  expenses,
  categories,
  departments,
  vendors,
  paymentMethods,
  bankAccounts,
  error,
}: {
  expenses: OperationalExpenseRow[]
  categories: string[]
  departments: NamedOption[]
  vendors: NamedOption[]
  paymentMethods: string[]
  bankAccounts: BankAccountChoice[]
  error: string | null
}) {
  const canAdd = useCan("expenses", "add")
  const canEdit = useCan("expenses", "edit")
  const canDelete = useCan("expenses", "delete")

  const visibility = useColumnVisibility(expenseColumnStore)
  const [sort, setSort] = useState<SortState<ExpenseColumnId>>({
    key: "expenseDate",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
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
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = paginateRows(filtered, page)

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
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Operational Expenses"
        className="mb-0 md:mb-2"
        actions={
          <>
            <ListExport
              grid={{
                filename: "operational-expenses",
                title: "Operational Expenses",
                columns: [
                  { header: "Date", kind: "text" },
                  { header: "Category", kind: "text" },
                  { header: "Amount", kind: "money" },
                  { header: "Payment Method", kind: "text" },
                  { header: "Department", kind: "text" },
                  { header: "Vendor", kind: "text" },
                ],
                rows: filtered.map((row) => [
                  formatDayMonYear(row.expenseDate),
                  row.category,
                  row.amount,
                  row.paymentMethod,
                  row.departmentName || "—",
                  row.vendorName || "—",
                ]),
              }}
            />
            {canAdd ? (
              <Button type="button" onClick={() => openForm(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add Expense
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
        placeholder="Search expenses"
      />
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
        emptyMessage="No Operational Expenses Yet."
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
        mobileItem={(expense) => ({
          title: expense.category || "—",
          subtitle: [
            expense.paymentMethod,
            expense.expenseDate ? formatIsoDate(expense.expenseDate) : "",
          ]
            .filter(Boolean)
            .join(" · "),
          meta: <Money value={expense.amount} />,
        })}
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
              {canEdit ? (<DropdownMenuItem onClick={() => openForm(expense)}>
                <Pencil aria-hidden="true" />
                Edit
              </DropdownMenuItem>) : null}
              <DropdownMenuSeparator />
              {canDelete ? (<DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setDeleteError(null)
                  setPendingDelete(expense)
                  setDeleteOpen(true)
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </DropdownMenuItem>) : null}
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
        departments={departments}
        vendors={vendors}
        paymentMethods={paymentMethods}
        bankAccounts={bankAccounts}
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
        title="Delete Operational Expense"
        itemName={pendingDelete?.vendorName || pendingDelete?.category}
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
        <span className="text-muted-foreground">{formatIsoDate(expense.expenseDate)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "category":
      return (
        <span
          className={cn(
            "text-ui font-semibold",
            !expense.category && "text-muted-foreground",
          )}
        >
          {expense.category || "—"}
        </span>
      )
    case "amount":
      return <Money value={expense.amount} />
    case "paymentMethod":
      return expense.paymentMethod ? (
        <span>{expense.paymentMethod}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}
