"use client"

import { ListExport } from "@/components/list-export"
import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { deleteEmployee } from "@/app/(app)/hr/employees/actions"
import { useAccess, useCan } from "@/components/access-provider"
import { EmployeeFormDialog } from "@/app/(app)/hr/employees/employee-form-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { compareText, formatDayMonYear } from "@/lib/format"
import type { DepartmentOption, EmployeeRow } from "@/lib/employees"
import {
  CLIENT_PAGE_SIZES,
  paginateRows,
  rangeLabel,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import { useListUrlState } from "@/lib/use-list-url-state"

type ColumnId =
  | "fullName"
  | "department"
  | "designation"
  | "monthlySalary"
  | "allowance"
  | "joiningDate"
  | "isActive"

const columns: readonly ListColumn<ColumnId>[] = [
  { id: "fullName", label: "Name", align: "left", locked: true },
  { id: "department", label: "Department", align: "left", locked: true },
  { id: "designation", label: "Designation", align: "left", locked: true },
  { id: "monthlySalary", label: "Monthly Salary", align: "right", locked: true },
  { id: "allowance", label: "Allowance", align: "right", locked: true },
  { id: "joiningDate", label: "Joining Date", align: "left", locked: true },
  {
    id: "isActive",
    label: "Status",
    align: "left",
    locked: true,
    sortText: { asc: "Inactive first", desc: "Active first" },
  },
]
const employeeSortKeys = columns.map((column) => column.id)
const defaultEmployeeSort: SortState<ColumnId> = {
  key: "fullName",
  direction: "asc",
}
const employeeStatusValues = ["all", "active", "inactive"] as const
const filterOptions = [
  { value: "all", label: "All Employees" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
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
        cmp = compareText(a.fullName, b.fullName)
        break
      case "department":
        cmp = compareText(a.department, b.department)
        break
      case "designation":
        cmp = compareText(a.designation, b.designation)
        break
      case "monthlySalary":
        cmp = a.monthlySalary - b.monthlySalary
        break
      case "allowance":
        cmp = a.allowance - b.allowance
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
  nextCode,
  error,
}: {
  employees: EmployeeRow[]
  departments: DepartmentOption[]
  nextCode: string
  error: string | null
  initialQuery?: string
}) {
  const showFinancials = useAccess().showFinancials
  const canAdd = useCan("employees", "add")

  const {
    query,
    setQuery,
    facet: listFilter,
    setFacet: setListFilter,
    sort,
    onSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    clearFilters,
    hasActiveFilters,
  } = useListUrlState<ColumnId>({
    sortKeys: employeeSortKeys,
    defaultSort: defaultEmployeeSort,
    facet: { key: "status", options: employeeStatusValues },
  })
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
  const filtered = useMemo(
    () =>
      filterRows(sorted, query, rowText, listFilter, (employee) =>
        employee.isActive ? "active" : "inactive",
      ),
    [listFilter, query, sorted],
  )
  const pageResult = useMemo(
    () => paginateRows(filtered, page, pageSize),
    [filtered, page, pageSize],
  )

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
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Employees"
        className="mb-0 md:mb-2"
        actions={
          <>
            <ListExport
              grid={{
                filename: "employees",
                title: "Employees",
                columns: [
                  { header: "Name", kind: "text" },
                  { header: "Department", kind: "text" },
                  { header: "Designation", kind: "text" },
                  { header: "Monthly Salary", kind: "money" },
                  { header: "Allowance", kind: "money" },
                  { header: "Joining Date", kind: "text" },
                  { header: "Status", kind: "text" },
                ],
                rows: filtered.map((employee) => [
                  employee.fullName,
                  employee.department,
                  employee.designation,
                  showFinancials ? employee.monthlySalary : "Hidden",
                  showFinancials ? employee.allowance : "Hidden",
                  employee.joiningDate ? formatDayMonYear(employee.joiningDate) : "—",
                  employee.isActive ? "Active" : "Inactive",
                ]),
              }}
            />
            {canAdd ? (
              <Button type="button" onClick={() => openForm(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add New Employee
              </Button>
            ) : null}
          </>
        }
      />

      <ListSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Search employees"
        filterLabel="Status"
        filter={listFilter}
        onFilterChange={setListFilter}
        options={filterOptions}
      />
      <DataList
        columns={columns}
        rows={error ? [] : pageResult.rows}
        rowKey={(employee) => employee.id}
        sort={sort}
        onSort={onSort}
        visibility={{}}
        error={error}
        emptyMessage="No Employees Yet."
        emptyState={
          employees.length === 0 && !hasActiveFilters
            ? {
                kind: "none",
                action: canAdd ? (
                  <Button type="button" onClick={() => openForm(null)}>
                    <Plus aria-hidden="true" data-icon="inline-start" />
                    Add New Employee
                  </Button>
                ) : undefined,
              }
            : { kind: "filtered", onClearFilters: clearFilters }
        }
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "employee",
          "employees",
        )}
        totalCount={error ? 0 : pageResult.total}
        pageSize={{
          value: pageSize,
          options: CLIENT_PAGE_SIZES,
          onChange: setPageSize,
        }}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Employees pagination"
        mobileItem={(employee) => ({
          title: employee.fullName || "—",
          value: (
            <StatusBadge status={employee.isActive ? "active" : "inactive"} />
          ),
          subtitle:
            [employee.designation, employee.department].filter(Boolean).join(" · ") ||
            "—",
          meta: showFinancials ? (
            <Money value={employee.monthlySalary} />
          ) : (
            "Hidden"
          ),
        })}
        renderCell={(employee, columnId) => (
          <Cell employee={employee} columnId={columnId} />
        )}
        renderActions={(employee) => (
          <RowActions
            employee={employee}
            onEdit={openForm}
            onDelete={askDelete}
          />
        )}
      />

      <EmployeeFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        employee={formEmployee}
        departments={departments}
        nextCode={nextCode}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) return
          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete Employee"
        itemName={pendingDelete?.fullName}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function Cell({
  employee,
  columnId,
}: {
  employee: EmployeeRow
  columnId: ColumnId
}) {
  const showFinancials = useAccess().showFinancials

  switch (columnId) {
    case "fullName":
      return (
        <span className="text-ui font-semibold">{employee.fullName || "—"}</span>
      )
    case "department":
      return employee.department ? (
        <span>{employee.department}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "designation":
      return employee.designation ? (
        <Badge variant="outline">{employee.designation}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "monthlySalary":
      return showFinancials ? (
        <Money value={employee.monthlySalary} />
      ) : (
        <span className="text-muted-foreground">Hidden</span>
      )
    case "allowance":
      return showFinancials ? (
        <Money value={employee.allowance} />
      ) : (
        <span className="text-muted-foreground">Hidden</span>
      )
    case "joiningDate":
      return employee.joiningDate ? (
        <span>{formatDayMonYear(employee.joiningDate)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "isActive":
      return <StatusBadge status={employee.isActive ? "active" : "inactive"} />
  }
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
  const canEdit = useCan("employees", "edit")
  const canDelete = useCan("employees", "delete")
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
        {canEdit ? (
          <DropdownMenuItem onClick={() => onEdit(employee)}>
            <Pencil aria-hidden="true" />
            Edit
          </DropdownMenuItem>
        ) : null}
        {canEdit && canDelete ? <DropdownMenuSeparator /> : null}
        {canDelete ? (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => onDelete(employee)}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
