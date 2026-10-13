"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { Eye, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import { deleteMonthlySalary } from "@/app/(app)/hr/payroll/actions"
import { useAccess, useCan } from "@/components/access-provider"
import { PaySalariesDialog } from "@/app/(app)/hr/payroll/pay-salaries-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BankAccountChoice } from "@/lib/bank-account"
import { formatIsoDate, formatTaka } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import type { MonthlySalary, SalaryEmployee } from "@/lib/payroll"
import { monthLabel } from "@/lib/payroll-month"

type ColumnId =
  | "month"
  | "employees"
  | "totalPaid"
  | "paidOn"
  | "bankAccount"
  | "status"

const columns: readonly ListColumn<ColumnId>[] = [
  { id: "month", label: "Month", align: "left", locked: true },
  { id: "employees", label: "Employees", align: "right", locked: true },
  { id: "totalPaid", label: "Total Paid", align: "right", locked: true },
  { id: "paidOn", label: "Paid On", align: "left", locked: true },
  { id: "bankAccount", label: "Bank Account", align: "left", locked: true },
  { id: "status", label: "Status", align: "left", locked: true },
]

function sortSalaries(
  rows: MonthlySalary[],
  sort: SortState<ColumnId>,
  accountName: (id: string) => string,
): MonthlySalary[] {
  const sorted = [...rows]
  sorted.sort((left, right) => {
    let cmp = 0
    switch (sort.key) {
      case "month":
        cmp =
          left.periodYear - right.periodYear ||
          left.periodMonth - right.periodMonth
        break
      case "employees":
        cmp = left.lineCount - right.lineCount
        break
      case "totalPaid":
        cmp = left.totalPaid - right.totalPaid
        break
      case "paidOn":
        cmp = left.paidOn.localeCompare(right.paidOn)
        break
      case "bankAccount":
        cmp = accountName(left.bankAccountId).localeCompare(
          accountName(right.bankAccountId),
          "en",
          { sensitivity: "base" },
        )
        break
      case "status":
        cmp = 0
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })
  return sorted
}

export function PayrollTable({
  salaries,
  employees,
  bankAccounts,
  paymentMethods,
  error,
}: {
  salaries: MonthlySalary[]
  employees: SalaryEmployee[]
  bankAccounts: BankAccountChoice[]
  paymentMethods: string[]
  error: string | null
}) {
  const canAdd = useCan("payroll", "add")
  const canEdit = useCan("payroll", "edit")
  const canDelete = useCan("payroll", "delete")

  const [sort, setSort] = useState<SortState<ColumnId>>({
    key: "month",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [formSalary, setFormSalary] = useState<MonthlySalary | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<MonthlySalary | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const accountNames = useMemo(
    () => new Map(bankAccounts.map((account) => [account.id, account.name])),
    [bankAccounts],
  )
  const sorted = useMemo(
    () => sortSalaries(salaries, sort, (id) => accountNames.get(id) ?? ""),
    [accountNames, salaries, sort],
  )
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = paginateRows(filtered, page)
  const takenMonths = salaries.map(
    (salary) =>
      `${salary.periodYear}-${String(salary.periodMonth).padStart(2, "0")}`,
  )

  function openForm(salary: MonthlySalary | null) {
    setFormSalary(salary)
    setFormSession((current) => current + 1)
    setFormOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteMonthlySalary(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }
        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this monthly salary.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">Payroll</h1>
      <ListSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        placeholder="Search payroll"
      />
      <DataList
        columns={columns}
        rows={error ? [] : pageResult.rows}
        rowKey={(salary) => salary.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
          setPage(1)
        }}
        visibility={{}}
        error={error}
        emptyMessage="No Monthly Salaries Yet."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "month",
          "months",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Payroll pagination"
        toolbar={
          canAdd ? (
            <Button type="button" onClick={() => openForm(null)}>
              <Plus aria-hidden="true" data-icon="inline-start" />
              Pay Salaries
            </Button>
          ) : null
        }
        renderCell={(salary, columnId) => (
          <Cell
            salary={salary}
            columnId={columnId}
            bankAccount={accountNames.get(salary.bankAccountId) ?? ""}
          />
        )}
        renderActions={(salary) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${monthLabel(salary.periodYear, salary.periodMonth)}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                nativeButton={false}
                render={<Link href={`/hr/payroll/${salary.id}`} />}
              >
                <Eye aria-hidden="true" />
                View
              </DropdownMenuItem>
              {canEdit ? (<DropdownMenuItem onClick={() => openForm(salary)}>
                <Pencil aria-hidden="true" />
                Edit
              </DropdownMenuItem>) : null}
              <DropdownMenuSeparator />
              {canDelete ? (<DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setDeleteError(null)
                  setPendingDelete(salary)
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
      <PaySalariesDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        salary={formSalary}
        employees={employees}
        takenMonths={takenMonths}
        bankAccounts={bankAccounts}
        paymentMethods={paymentMethods}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen || deleting) return
          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete Monthly Salary"
        itemName={
          pendingDelete
            ? monthLabel(pendingDelete.periodYear, pendingDelete.periodMonth)
            : null
        }
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function Cell({
  salary,
  columnId,
  bankAccount,
}: {
  salary: MonthlySalary
  columnId: ColumnId
  bankAccount: string
}) {
  const showFinancials = useAccess().showFinancials
  switch (columnId) {
    case "month":
      return (
        <Link
          href={`/hr/payroll/${salary.id}`}
          className="font-medium underline underline-offset-4"
        >
          {monthLabel(salary.periodYear, salary.periodMonth)}
        </Link>
      )
    case "employees":
      return <span>{salary.lineCount}</span>
    case "totalPaid":
      return <span>{showFinancials ? formatTaka(salary.totalPaid) : "Hidden"}</span>
    case "paidOn":
      return salary.paidOn ? (
        <span>{formatIsoDate(salary.paidOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "bankAccount":
      return bankAccount ? (
        <span>{bankAccount}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "status":
      return <StatusBadge status="paid" />
  }
}
