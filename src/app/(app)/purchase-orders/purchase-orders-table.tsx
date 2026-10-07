"use client"

import {
  ChevronLeft,
  ChevronRight,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useSyncExternalStore, useTransition } from "react"

import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
import { deletePurchaseOrder } from "@/app/(app)/purchase-orders/actions"
import { PurchaseOrderFormDialog } from "@/app/(app)/purchase-orders/purchase-order-form-dialog"
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
import { formatMoney } from "@/lib/format"
import {
  getColumnServerSnapshot,
  getColumnSnapshot,
  subscribeColumnVisibility,
} from "@/lib/purchase-order-column-store"
import type { ProjectFilter } from "@/lib/purchase-orders"
import {
  dataColumns,
  formatPurchaseOrderDate,
  isColumnVisible,
  paginatePurchaseOrders,
  paginationItems,
  purchaseOrderRangeLabel,
  sortPurchaseOrders,
  type ColumnId,
  type ProjectOption,
  type PurchaseOrderRow,
  type SortState,
  type VendorOption,
} from "@/lib/purchase-order-summary"
import { cn } from "@/lib/utils"

const pillClassName = "h-7 gap-1.5 rounded-full px-2.5 text-sm font-medium"

export function PurchaseOrdersTable({
  orders,
  projects,
  vendors,
  workTypes,
  projectFilter,
  error,
}: {
  orders: PurchaseOrderRow[]
  projects: ProjectOption[]
  vendors: VendorOption[]
  workTypes: string[]
  projectFilter: ProjectFilter | null
  error: string | null
}) {
  const visibility = useSyncExternalStore(
    subscribeColumnVisibility,
    getColumnSnapshot,
    getColumnServerSnapshot,
  )
  const [sort, setSort] = useState<SortState>({
    key: "issuedOn",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formOrder, setFormOrder] = useState<PurchaseOrderRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PurchaseOrderRow | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const visibleColumns = dataColumns.filter((column) =>
    isColumnVisible(column.id, visibility),
  )
  const columnCount = visibleColumns.length + 1
  const sorted = useMemo(
    () => sortPurchaseOrders(orders, sort),
    [orders, sort],
  )
  const pageResult = useMemo(
    () => paginatePurchaseOrders(sorted, page),
    [sorted, page],
  )
  const pages = paginationItems(pageResult.currentPage, pageResult.pageCount)

  function toggleSort(key: ColumnId) {
    setSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        }
      }

      return { key, direction: "asc" }
    })
    setPage(1)
  }

  function openForm(order: PurchaseOrderRow | null) {
    setFormOrder(order)
    setFormSession((current) => current + 1)
    setFormOpen(true)
  }

  function askDelete(order: PurchaseOrderRow) {
    setDeleteError(null)
    setPendingDelete(order)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deletePurchaseOrder(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this purchase order.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-medium tracking-tight">
            Purchase Orders
          </h1>
          {projectFilter ? (
            <p className="text-sm text-muted-foreground">
              For {projectFilter.name || "this project"}.{" "}
              <Link
                href="/purchase-orders"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Show all
              </Link>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => openForm(null)}>
            <Plus aria-hidden="true" data-icon="inline-start" />
            Assign Purchase Order
          </Button>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {visibleColumns.map((column) => {
                const active = sort.key === column.id
                return (
                  <TableHead
                    key={column.id}
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={cn(
                      "px-3 text-sm",
                      column.align === "right" && "text-right",
                    )}
                  >
                    <div
                      className={cn(
                        "flex",
                        column.align === "right" && "justify-end",
                      )}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          "border-0",
                          column.align === "right" ? "-mr-2.5" : "-ml-2.5",
                        )}
                        aria-label={
                          active
                            ? `Sort by ${column.label}, ${sort.direction === "asc" ? "ascending" : "descending"}`
                            : `Sort by ${column.label}`
                        }
                        onClick={() => toggleSort(column.id)}
                      >
                        {column.label}
                      </Button>
                    </div>
                  </TableHead>
                )
              })}
              <TableHead className="sticky right-0 z-10 w-16 bg-muted px-3">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  role="alert"
                  className="px-3 py-8 text-center whitespace-normal text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : pageResult.rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  className="px-3 py-8 text-center whitespace-normal text-muted-foreground"
                >
                  {projectFilter
                    ? "No Purchase Orders For This Project."
                    : "No Purchase Orders Yet."}
                </TableCell>
              </TableRow>
            ) : (
              pageResult.rows.map((order) => (
                <TableRow key={order.id} className="group">
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        "p-3 text-sm",
                        column.align === "right" && "text-right",
                        column.id === "vendorName" && "whitespace-normal",
                      )}
                    >
                      <CellValue order={order} columnId={column.id} />
                    </TableCell>
                  ))}
                  <TableCell className="sticky right-0 z-10 w-16 bg-card p-3 text-sm group-hover:bg-muted">
                    <RowActions
                      order={order}
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
            {purchaseOrderRangeLabel(
              pageResult.rangeStart,
              pageResult.rangeEnd,
              pageResult.total,
            )}
          </p>
          <Pagination
            aria-label="Purchase orders pagination"
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

      <PurchaseOrderFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        purchaseOrder={formOrder}
        projects={projects}
        vendors={vendors}
        workTypes={workTypes}
        defaultProjectId={projectFilter?.id ?? null}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Purchase Order</AlertDialogTitle>
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

function CellValue({
  order,
  columnId,
}: {
  order: PurchaseOrderRow
  columnId: ColumnId
}) {
  switch (columnId) {
    case "issuedOn":
      return order.issuedOn ? (
        <span>{formatPurchaseOrderDate(order.issuedOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "projectName":
      return order.projectName ? (
        <span className="font-medium">{order.projectName}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "vendorName":
      return (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-medium",
              !order.vendorName && "text-muted-foreground",
            )}
          >
            {order.vendorName || "—"}
          </span>
          {order.workType ? (
            <Badge variant="outline" className={cn(pillClassName, "bg-card")}>
              {order.workType}
            </Badge>
          ) : null}
        </div>
      )
    case "totalValue":
    case "totalPaid":
    case "totalPending":
      return (
        <span className="tabular-nums">{formatMoney(order[columnId])}</span>
      )
  }
}

function RowActions({
  order,
  onEdit,
  onDelete,
}: {
  order: PurchaseOrderRow
  onEdit: (order: PurchaseOrderRow) => void
  onDelete: (order: PurchaseOrderRow) => void
}) {
  const label = order.vendorName || order.projectName || "purchase order"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${label}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => onEdit(order)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          nativeButton={false}
          render={<Link href={`/purchase-orders/${order.id}`} />}
        >
          <FileText aria-hidden="true" />
          Vendor Payments
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(order)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
