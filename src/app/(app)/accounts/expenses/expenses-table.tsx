"use client"

import { ListSearch } from "@/components/list-search"
import { useCan } from "@/components/access-provider"

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition, type ReactNode } from "react"

import { exportOperationalExpensesGrid } from "@/app/(app)/accounts/export-actions"
import { deleteOperationalExpense } from "@/app/(app)/accounts/expenses/actions"
import { ExpenseFormDialog } from "@/app/(app)/accounts/expenses/expense-form-dialog"
import { DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader, SectionHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BankAccountChoice } from "@/lib/bank-account"
import { formatIsoDate } from "@/lib/format"
import { formatRecordedAt } from "@/lib/recorded-at"
import {
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
import { LIST_PAGE_SIZE } from "@/lib/page-query"
import { useColumnVisibility } from "@/lib/use-column-visibility"
import { useUrlSearch } from "@/lib/use-url-search"
import type { OfficeCategoryGroup } from "@/lib/report-cost-group"
import { cn } from "@/lib/utils"

export function ExpensesTable({
  expenses,
  poExpenses = [],
  categories,
  departments,
  paymentMethods,
  bankAccounts,
  total,
  page,
  pageCount,
  error,
  initialQuery = "",
  pager,
}: {
  expenses: OperationalExpenseRow[]
  poExpenses?: OperationalExpenseRow[]
  categories: OfficeCategoryGroup[]
  departments: NamedOption[]
  paymentMethods: string[]
  bankAccounts: BankAccountChoice[]
  total: number
  page: number
  pageCount: number
  error: string | null
  initialQuery?: string
  pager?: ReactNode
}) {
  const canAdd = useCan("expenses", "add")
  const canEdit = useCan("expenses", "edit")
  const canDelete = useCan("expenses", "delete")

  const visibility = useColumnVisibility(expenseColumnStore)
  const [sort, setSort] = useState<SortState<ExpenseColumnId>>({
    key: "expenseDate",
    direction: "desc",
  })
  const { query, setQuery, setPage } = useUrlSearch(initialQuery)
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
  const sortedPo = useMemo(
    () => sortExpenses(poExpenses, sort),
    [poExpenses, sort],
  )

  const effectiveTotal = error ? 0 : total
  const rangeStart =
    effectiveTotal === 0 || sorted.length === 0
      ? 0
      : (page - 1) * LIST_PAGE_SIZE + 1
  const rangeEnd =
    effectiveTotal === 0 || sorted.length === 0
      ? 0
      : Math.min(effectiveTotal, rangeStart + sorted.length - 1)

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
              loadGrid={() =>
                exportOperationalExpensesGrid({
                  q: query,
                  sortKey: sort.key,
                  sortDir: sort.direction,
                })
              }
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
        onQueryChange={setQuery}
        placeholder="Search expenses"
      />
      <DataList
        columns={expenseColumns}
        rows={error ? [] : sorted}
        rowKey={(expense) => expense.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
        }}
        visibility={visibility}
        error={error}
        emptyMessage={
          query.trim()
            ? "No Matching Operational Expenses."
            : "No Operational Expenses Yet."
        }
        rangeText={rangeLabel(
          rangeStart,
          rangeEnd,
          effectiveTotal,
          "expense",
          "expenses",
        )}
        currentPage={page}
        pageCount={pageCount}
        onPageChange={setPage}
        pagingLabel="Operational Expenses pagination"
        mobileItem={(expense) => ({
          title: expense.category || "—",
          subtitle: [
            expense.vendorName,
            expense.paymentMethod,
            expense.expenseDate ? formatIsoDate(expense.expenseDate) : "",
            expense.createdByName,
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
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                nativeButton={false}
                render={<Link href={`/documents/vouchers/new?expense=${expense.id}`} />}
              >
                Print / Download
              </DropdownMenuItem>
              {canEdit ? (
                <DropdownMenuItem onClick={() => openForm(expense)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </DropdownMenuItem>
              ) : null}
              {canEdit && canDelete ? <DropdownMenuSeparator /> : null}
              {canDelete ? (
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
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      {pager}
      {!error && sortedPo.length > 0 ? (
        <div className="mt-2 flex flex-col gap-3">
          <SectionHeader title="Operational Purchase Order Payments" />
          <DataList
            columns={expenseColumns}
            rows={sortedPo}
            rowKey={(expense) => expense.id}
            sort={sort}
            onSort={(key) => {
              setSort((current) => toggleSort(current, key))
            }}
            visibility={visibility}
            error={null}
            emptyMessage="No Operational Purchase Order Payments."
            rangeText={rangeLabel(
              1,
              sortedPo.length,
              sortedPo.length,
              "PO payment",
              "PO payments",
            )}
            currentPage={1}
            pageCount={1}
            onPageChange={() => {}}
            pagingLabel="Operational Purchase Order Payments"
            mobileItem={(expense) => ({
              title: expense.category || "—",
              subtitle: [
                "From Operational PO",
                expense.vendorName,
                expense.paymentMethod,
                expense.expenseDate ? formatIsoDate(expense.expenseDate) : "",
                expense.createdByName,
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
                      aria-label={`Actions for ${expense.category || "PO payment"}`}
                    />
                  }
                >
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    nativeButton={false}
                    render={<Link href={`/purchase-orders/${expense.purchaseOrderId}`} />}
                  >
                    View Purchase Order
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </div>
      ) : null}
      <ExpenseFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        expense={formExpense}
        categories={categories}
        departments={departments}
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
        <span className="flex min-w-0 flex-col">
          <span
            className={cn(
              "text-ui font-semibold",
              !expense.category && "text-muted-foreground",
            )}
          >
            {expense.category || "—"}
          </span>
          <span className="text-label text-muted-foreground">
            {expense.createdByName} · {formatRecordedAt(expense.createdAt)}
          </span>
          {expense.fromPurchaseOrder ? (
            <Link
              href={`/purchase-orders/${expense.purchaseOrderId}`}
              className="text-label text-muted-foreground underline underline-offset-4"
            >
              From Operational PO
            </Link>
          ) : null}
          {expense.vendorName ? (
            <span className="text-label text-muted-foreground">
              Vendor {expense.vendorName}
            </span>
          ) : null}
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
