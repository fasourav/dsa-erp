"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { ArrowLeft, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { deleteMonthlySalary } from "@/app/(app)/hr/payroll/actions"
import { useAccess, useCan } from "@/components/access-provider"
import { PaySalariesDialog } from "@/app/(app)/hr/payroll/pay-salaries-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import type { BankAccountChoice } from "@/lib/bank-account"
import { formatIsoDate, formatTaka } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import type { MonthlySalary, SalaryEmployee, SalaryLine } from "@/lib/payroll"
import { monthLabel } from "@/lib/payroll-month"

type ColumnId = "employee" | "salary" | "allowance" | "bonus" | "deduction" | "netPay"

const columns: readonly ListColumn<ColumnId>[] = [
  { id: "employee", label: "Employee", align: "left", locked: true },
  { id: "salary", label: "Salary", align: "right", locked: true },
  { id: "allowance", label: "Allowance", align: "right", locked: true },
  { id: "bonus", label: "Bonus", align: "right", locked: true },
  { id: "deduction", label: "Deduction", align: "right", locked: true },
  { id: "netPay", label: "Net Pay", align: "right", locked: true },
]

function sortLines(rows: SalaryLine[], sort: SortState<ColumnId>): SalaryLine[] {
  const sorted = [...rows]
  sorted.sort((left, right) => {
    let cmp = 0
    switch (sort.key) {
      case "employee":
        cmp = left.employeeName.localeCompare(right.employeeName, "en", {
          sensitivity: "base",
        })
        break
      case "salary":
        cmp = left.salary - right.salary
        break
      case "allowance":
        cmp = left.allowance - right.allowance
        break
      case "bonus":
        cmp = left.bonus - right.bonus
        break
      case "deduction":
        cmp = left.deduction - right.deduction
        break
      case "netPay":
        cmp = left.netPay - right.netPay
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })
  return sorted
}

export function PayrollDetailPanel({
  salary,
  employees,
  bankAccounts,
  paymentMethods,
}: {
  salary: MonthlySalary
  employees: SalaryEmployee[]
  bankAccounts: BankAccountChoice[]
  paymentMethods: string[]
}) {
  const showFinancials = useAccess().showFinancials
  const canEdit = useCan("payroll", "edit")
  const canDelete = useCan("payroll", "delete")

  const router = useRouter()
  const [sort, setSort] = useState<SortState<ColumnId>>({
    key: "employee",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(
    () => sortLines(salary.lines, sort),
    [salary.lines, sort],
  )
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = paginateRows(filtered, page)
  const bankAccount =
    bankAccounts.find((account) => account.id === salary.bankAccountId)?.name ??
    ""
  const label = monthLabel(salary.periodYear, salary.periodMonth)

  function confirmDelete() {
    startDelete(async () => {
      try {
        const result = await deleteMonthlySalary(salary.id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }
        router.push("/hr/payroll")
      } catch {
        setDeleteError("Could not delete this monthly salary.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            nativeButton={false}
            render={<Link href="/hr/payroll" aria-label="Back to Payroll" />}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-medium tracking-tight">{label}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status="paid" />
              <span className="text-sm text-muted-foreground">
                {salary.lineCount} Employees · Total{" "}
                {showFinancials ? formatTaka(salary.totalPaid) : "Hidden"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Paid On {salary.paidOn ? formatIsoDate(salary.paidOn) : "—"}
              {bankAccount ? ` · ${bankAccount}` : ""}
              {salary.paymentMethod ? ` · ${salary.paymentMethod}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canEdit ? (<Button
            type="button"
            variant="outline"
            onClick={() => {
              setFormSession((current) => current + 1)
              setFormOpen(true)
            }}
          >
            <Pencil aria-hidden="true" data-icon="inline-start" />
            Edit
          </Button>) : null}
          {canDelete ? (<Button
            type="button"
            variant="outline"
            onClick={() => {
              setDeleteError(null)
              setDeleteOpen(true)
            }}
          >
            <Trash2 aria-hidden="true" data-icon="inline-start" />
            Delete
          </Button>) : null}
        </div>
      </div>

      <ListSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        placeholder="Search lines"
      />
      <DataList
        columns={columns}
        rows={pageResult.rows}
        rowKey={(line) => line.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
          setPage(1)
        }}
        visibility={{}}
        error={null}
        emptyMessage="No Employees On This Salary."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          pageResult.total,
          "employee",
          "employees",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Salary slips pagination"
        renderCell={(line, columnId) => <Cell line={line} columnId={columnId} />}
      />

      <PaySalariesDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        salary={salary}
        employees={employees}
        takenMonths={[]}
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
        itemName={label}
        error={deleteError}
        pending={deleting}
        confirmKey={salary.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function Cell({ line, columnId }: { line: SalaryLine; columnId: ColumnId }) {
  const showFinancials = useAccess().showFinancials
  const money = (value: number) => (showFinancials ? formatTaka(value) : "Hidden")
  switch (columnId) {
    case "employee":
      return <span className="font-medium">{line.employeeName || "—"}</span>
    case "salary":
      return <span>{money(line.salary)}</span>
    case "allowance":
      return <span>{money(line.allowance)}</span>
    case "bonus":
      return <span>{money(line.bonus)}</span>
    case "deduction":
      return <span>{money(line.deduction)}</span>
    case "netPay":
      return <span className="font-medium">{money(line.netPay)}</span>
  }
}
