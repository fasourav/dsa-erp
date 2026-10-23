"use client"

import type { ReactNode } from "react"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { deleteMonthlySalary } from "@/app/(app)/hr/payroll/actions"
import { useAccess, useCan } from "@/components/access-provider"
import { PaySalariesDialog } from "@/app/(app)/hr/payroll/pay-salaries-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { BankAccountChoice } from "@/lib/bank-account"
import { formatDayMonYear } from "@/lib/format"
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
  const [section, setSection] = useState("lines")
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
  const bonus = useMemo(
    () => salary.lines.reduce((sum, line) => sum + line.bonus, 0),
    [salary.lines],
  )
  const deduction = useMemo(
    () => salary.lines.reduce((sum, line) => sum + line.deduction, 0),
    [salary.lines],
  )

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
    <div className="flex flex-col gap-3.5">
      <PageHeader
        eyebrow={
          <Link href="/hr/payroll" className="hover:text-foreground">
            Payroll
          </Link>
        }
        title={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            {label}
            <StatusBadge status="paid" />
          </span>
        }
        className="mb-0 md:mb-2"
        actions={
          <>
            {canEdit ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormSession((current) => current + 1)
                  setFormOpen(true)
                }}
              >
                <Pencil aria-hidden="true" data-icon="inline-start" />
                Edit
              </Button>
            ) : null}
            {canDelete ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDeleteError(null)
                  setDeleteOpen(true)
                }}
              >
                <Trash2 aria-hidden="true" data-icon="inline-start" />
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        <Kpi
          label="Employees"
          value={<span className="tabular-nums">{salary.lineCount}</span>}
        />
        <Kpi
          label="Total Paid"
          value={showFinancials ? <Money value={salary.totalPaid} size="kpi" /> : "Hidden"}
        />
        <Kpi
          label="Bonus"
          value={showFinancials ? <Money value={bonus} size="kpi" /> : "Hidden"}
        />
        <Kpi
          label="Deductions"
          value={showFinancials ? <Money value={deduction} size="kpi" /> : "Hidden"}
        />
      </div>

      <Tabs
        value={section}
        onValueChange={(value) => {
          if (value) setSection(value)
        }}
      >
        <TabsList>
          <TabsTrigger value="lines">Salary Lines</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
        </TabsList>
        <TabsContent value="lines" className="flex flex-col gap-3.5">
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
            mobileItem={(line) => ({
              title: line.employeeName || "—",
              subtitle: "Net Pay",
              value: showFinancials ? <Money value={line.netPay} /> : "Hidden",
            })}
            renderCell={(line, columnId) => <Cell line={line} columnId={columnId} />}
          />
        </TabsContent>
        <TabsContent value="payment">
          <Card>
            <dl>
              <DetailRow label="Paid On" value={salary.paidOn ? formatDayMonYear(salary.paidOn) : "—"} />
              <DetailRow label="Bank Account" value={bankAccount || "—"} />
              <DetailRow label="Payment Method" value={salary.paymentMethod || "—"} />
              <DetailRow label="Employees" value={String(salary.lineCount)} />
            </dl>
          </Card>
        </TabsContent>
      </Tabs>

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

function Kpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="text-label text-muted-foreground">{label}</p>
        <p className="text-metric">{value}</p>
      </CardContent>
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0 md:px-6">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}

function Cell({ line, columnId }: { line: SalaryLine; columnId: ColumnId }) {
  const showFinancials = useAccess().showFinancials
  const amount = (value: number) =>
    showFinancials ? <Money value={value} /> : <span className="text-muted-foreground">Hidden</span>

  switch (columnId) {
    case "employee":
      return (
        <Link href={`/documents/salary-slips/new?line=${line.id}`} className="text-ui font-semibold">
          {line.employeeName || "—"}
        </Link>
      )
    case "salary":
      return amount(line.salary)
    case "allowance":
      return amount(line.allowance)
    case "bonus":
      return amount(line.bonus)
    case "deduction":
      return amount(line.deduction)
    case "netPay":
      return showFinancials ? (
        <Money value={line.netPay} className="font-semibold" />
      ) : (
        <span className="text-muted-foreground">Hidden</span>
      )
  }
}
