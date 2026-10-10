"use client"

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import { deletePayrollRun } from "@/app/(app)/hr/payroll/actions"
import { PayrollRunFormDialog } from "@/app/(app)/hr/payroll/payroll-run-form-dialog"
import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
import { Badge } from "@/components/ui/badge"
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
import { formatIsoDate, formatMoney } from "@/lib/format"
import type { BankAccountChoice } from "@/lib/bank-account"
import type { PayrollRunRow } from "@/lib/payroll"

const monthNames = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

type ColId = "period" | "paidOn" | "status" | "lineCount" | "totalNet"

function sortRuns(
  rows: PayrollRunRow[],
  sort: SortState<ColId>,
): PayrollRunRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case "period":
        cmp = a.periodYear - b.periodYear || a.periodMonth - b.periodMonth
        break
      case "paidOn":
        cmp = a.paidOn.localeCompare(b.paidOn)
        break
      case "status":
        cmp = a.status.localeCompare(b.status)
        break
      case "lineCount":
        cmp = a.lineCount - b.lineCount
        break
      case "totalNet":
        cmp = a.totalNet - b.totalNet
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })
  return sorted
}

function statusVariant(
  status: string,
): "secondary" | "outline" | "destructive" {
  if (status === "paid") return "secondary"
  if (status === "approved") return "outline"
  return "outline"
}

export function PayrollRunsTable({
  runs,
  bankAccounts,
  paymentMethods,
  error,
}: {
  runs: PayrollRunRow[]
  bankAccounts: BankAccountChoice[]
  paymentMethods: string[]
  error: string | null
}) {
  const [sort, setSort] = useState<SortState<ColId>>({
    key: "period",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formRun, setFormRun] = useState<PayrollRunRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PayrollRunRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(() => sortRuns(runs, sort), [runs, sort])
  const pageResult = useMemo(() => paginateRows(sorted, page), [sorted, page])
  const pages = paginationItems(pageResult.currentPage, pageResult.pageCount)

  function openForm(run: PayrollRunRow | null) {
    setFormRun(run)
    setFormSession((s) => s + 1)
    setFormOpen(true)
  }

  function askDelete(run: PayrollRunRow) {
    setDeleteError(null)
    setPendingDelete(run)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deletePayrollRun(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }
        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this payroll run.")
      }
    })
  }

  const cols: { id: ColId; label: string; align: "left" | "right" }[] = [
    { id: "period", label: "Period", align: "left" },
    { id: "paidOn", label: "Paid On", align: "left" },
    { id: "status", label: "Status", align: "left" },
    { id: "lineCount", label: "Employees", align: "right" },
    { id: "totalNet", label: "Total Net", align: "right" },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Payroll</h1>
        <Button type="button" onClick={() => openForm(null)}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          New Payroll Run
        </Button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {cols.map((col) => {
                const active = sort.key === col.id
                return (
                  <TableHead
                    key={col.id}
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={col.align === "right" ? "text-right" : ""}
                  >
                    <div
                      className={`flex ${col.align === "right" ? "justify-end" : ""}`}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className={
                          col.align === "right" ? "-mr-2" : "-ml-2"
                        }
                        onClick={() => {
                          setSort(toggleSort(sort, col.id))
                          setPage(1)
                        }}
                      >
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
                <TableCell
                  colSpan={cols.length + 1}
                  role="alert"
                  className="py-8 text-center whitespace-normal text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : pageResult.rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={cols.length + 1}
                  className="py-8 text-center whitespace-normal text-muted-foreground"
                >
                  No Payroll Runs Yet.
                </TableCell>
              </TableRow>
            ) : (
              pageResult.rows.map((run) => (
                <TableRow key={run.id} className="group">
                  <TableCell className="font-medium">
                    <Link
                      href={`/hr/payroll/${run.id}`}
                      className="underline underline-offset-4"
                    >
                      {monthNames[run.periodMonth] ?? ""} {run.periodYear}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {run.paidOn ? formatIsoDate(run.paidOn) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariant(run.status)}
                      className="rounded-full capitalize"
                    >
                      {run.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {run.lineCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(run.totalNet)}
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 w-16 bg-card group-hover:bg-muted">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${monthNames[run.periodMonth]} ${run.periodYear}`}
                          />
                        }
                      >
                        <MoreHorizontal
                          aria-hidden="true"
                          className="size-4"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          nativeButton={false}
                          render={<Link href={`/hr/payroll/${run.id}`} />}
                        >
                          <Eye aria-hidden="true" />
                          View Lines
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openForm(run)}>
                          <Pencil aria-hidden="true" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => askDelete(run)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete
                        </DropdownMenuItem>
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
            {rangeLabel(
              pageResult.rangeStart,
              pageResult.rangeEnd,
              pageResult.total,
              "run",
              "runs",
            )}
          </p>
          <Pagination
            aria-label="Payroll runs pagination"
            className="mx-0 w-auto justify-start sm:justify-end"
          >
            <PaginationContent className="flex-wrap">
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pageResult.currentPage <= 1}
                  aria-label="Go to previous page"
                  onClick={() => setPage(pageResult.currentPage - 1)}
                >
                  <ChevronLeft aria-hidden="true" data-icon="inline-start" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
              </PaginationItem>
              {pages.map((item, index) =>
                item === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <Button
                      type="button"
                      variant={
                        item === pageResult.currentPage ? "outline" : "ghost"
                      }
                      size="icon"
                      aria-label={`Page ${item}`}
                      aria-current={
                        item === pageResult.currentPage ? "page" : undefined
                      }
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </Button>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pageResult.currentPage >= pageResult.pageCount}
                  aria-label="Go to next page"
                  onClick={() => setPage(pageResult.currentPage + 1)}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight aria-hidden="true" data-icon="inline-end" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      <PayrollRunFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        run={formRun}
        bankAccounts={bankAccounts}
        paymentMethods={paymentMethods}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) return
          setDeleteOpen(false)
          setDeleteError(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payroll Run</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure to delete this item? If yes, Press and Hold
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <HoldToDeleteButton
              key={pendingDelete?.id}
              pending={deleting}
              onConfirm={confirmDelete}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
