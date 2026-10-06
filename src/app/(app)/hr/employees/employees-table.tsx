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

import { deleteEmployee } from "@/app/(app)/hr/employees/actions"
import { EmployeeFormDialog } from "@/app/(app)/hr/employees/employee-form-dialog"
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
import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
import {
  paginateRows,
  paginationItems,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { formatIsoDate } from "@/lib/format"
import type { DepartmentOption, EmployeeRow } from "@/lib/employees"

type ColumnId =
  | "fullName"
  | "department"
  | "designation"
  | "joiningDate"
  | "isActive"

const columns: { id: ColumnId; label: string; align: "left" | "right" }[] = [
  { id: "fullName", label: "Name", align: "left" },
  { id: "department", label: "Department", align: "left" },
  { id: "designation", label: "Designation", align: "left" },
  { id: "joiningDate", label: "Joining Date", align: "left" },
  { id: "isActive", label: "Status", align: "left" },
]

function sortEmployees(
  rows: EmployeeRow[],
  sort: SortState<ColumnId>,
): EmployeeRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case "fullName":
        cmp = a.fullName.localeCompare(b.fullName, "en", {
          sensitivity: "base",
        })
        break
      case "department":
        cmp = a.department.localeCompare(b.department, "en", {
          sensitivity: "base",
        })
        break
      case "designation":
        cmp = a.designation.localeCompare(b.designation, "en", {
          sensitivity: "base",
        })
        break
      case "joiningDate":
        cmp = a.joiningDate.localeCompare(b.joiningDate)
        break
      case "isActive":
        cmp = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0)
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })
  return sorted
}

export function EmployeesTable({
  employees,
  departments,
  error,
}: {
  employees: EmployeeRow[]
  departments: DepartmentOption[]
  error: string | null
}) {
  const [sort, setSort] = useState<SortState<ColumnId>>({
    key: "fullName",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formEmployee, setFormEmployee] = useState<EmployeeRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<EmployeeRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(
    () => sortEmployees(employees, sort),
    [employees, sort],
  )
  const pageResult = useMemo(() => paginateRows(sorted, page), [sorted, page])
  const pages = paginationItems(pageResult.currentPage, pageResult.pageCount)

  function openForm(emp: EmployeeRow | null) {
    setFormEmployee(emp)
    setFormSession((s) => s + 1)
    setFormOpen(true)
  }

  function askDelete(emp: EmployeeRow) {
    setDeleteError(null)
    setPendingDelete(emp)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteEmployee(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }
        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this employee.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Employees</h1>
        <Button type="button" onClick={() => openForm(null)}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add New Employee
        </Button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {columns.map((col) => {
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
                  >
                    <div className="flex">
                      <Button
                        type="button"
                        variant="ghost"
                        className="-ml-2"
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
                  colSpan={columns.length + 1}
                  role="alert"
                  className="py-8 text-center whitespace-normal text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : pageResult.rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length + 1}
                  className="py-8 text-center whitespace-normal text-muted-foreground"
                >
                  No Employees Yet.
                </TableCell>
              </TableRow>
            ) : (
              pageResult.rows.map((emp) => (
                <TableRow key={emp.id} className="group">
                  <TableCell className="font-medium">
                    {emp.fullName || "—"}
                  </TableCell>
                  <TableCell>{emp.department || "—"}</TableCell>
                  <TableCell>{emp.designation || "—"}</TableCell>
                  <TableCell>
                    {emp.joiningDate ? formatIsoDate(emp.joiningDate) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={emp.isActive ? "secondary" : "outline"}
                      className="rounded-full"
                    >
                      {emp.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 w-16 bg-card group-hover:bg-muted">
                    <RowActions
                      employee={emp}
                      onEdit={openForm}
                      onDelete={askDelete}
                    />
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
              "employee",
              "employees",
            )}
          </p>
          <Pagination
            aria-label="Employees pagination"
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

      <EmployeeFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={formEmployee}
        departments={departments}
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
            <AlertDialogTitle>Delete Employee</AlertDialogTitle>
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

function RowActions({
  employee,
  onEdit,
  onDelete,
}: {
  employee: EmployeeRow
  onEdit: (emp: EmployeeRow) => void
  onDelete: (emp: EmployeeRow) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${employee.fullName || "employee"}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => onEdit(employee)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(employee)}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
