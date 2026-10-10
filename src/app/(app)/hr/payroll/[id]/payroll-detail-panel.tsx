"use client"

import {
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"

import { deletePayrollLine } from "@/app/(app)/hr/payroll/actions"
import { PayrollLineFormDialog } from "@/app/(app)/hr/payroll/[id]/payroll-line-form-dialog"
import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
import { StatusBadge } from "@/components/status-badge"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatMoney } from "@/lib/format"
import type {
  EmployeeOption,
  PayrollLineRow,
  PayrollRunRow,
} from "@/lib/payroll"

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

export function PayrollDetailPanel({
  run,
  lines,
  employees,
}: {
  run: PayrollRunRow
  lines: PayrollLineRow[]
  employees: EmployeeOption[]
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [formLine, setFormLine] = useState<PayrollLineRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PayrollLineRow | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  function openForm(line: PayrollLineRow | null) {
    setFormLine(line)
    setFormSession((s) => s + 1)
    setFormOpen(true)
  }

  function askDelete(line: PayrollLineRow) {
    setDeleteError(null)
    setPendingDelete(line)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deletePayrollLine(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }
        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this payroll line.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            nativeButton={false}
            render={<Link href="/hr/payroll" aria-label="Back to payroll" />}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-medium tracking-tight">
              {monthNames[run.periodMonth]} {run.periodYear}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={run.status} />
              <span className="text-sm text-muted-foreground">
                {lines.length} Employee{lines.length !== 1 ? "s" : ""} ·
                Total {formatMoney(run.totalNet)}
              </span>
            </div>
          </div>
        </div>
        <Button type="button" onClick={() => openForm(null)}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add Payroll Line
        </Button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-max">
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Basic Salary</TableHead>
                <TableHead className="text-right">Allowance</TableHead>
                <TableHead className="text-right">Bonus</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net Salary</TableHead>
                <TableHead className="sticky right-0 z-10 w-16 bg-muted">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center whitespace-normal text-muted-foreground"
                  >
                    No Payroll Lines Yet.
                  </TableCell>
                </TableRow>
              ) : (
                lines.map((line) => (
                  <TableRow key={line.id} className="group">
                    <TableCell className="font-medium">
                      {line.employeeName || "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(line.basicSalary)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(line.allowance)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(line.bonus)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(line.deductions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatMoney(line.netSalary)}
                    </TableCell>
                    <TableCell className="sticky right-0 z-10 w-16 bg-card group-hover:bg-muted">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Actions for ${line.employeeName}`}
                            />
                          }
                        >
                          <MoreHorizontal
                            aria-hidden="true"
                            className="size-4"
                          />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem onClick={() => openForm(line)}>
                            <Pencil aria-hidden="true" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => askDelete(line)}
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
        </div>
      </div>

      <PayrollLineFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        runId={run.id}
        line={formLine}
        employees={employees}
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
            <AlertDialogTitle>Delete Payroll Line</AlertDialogTitle>
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
