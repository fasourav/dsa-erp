"use client"

import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import { deleteVendor } from "@/app/(app)/vendors/actions"
import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
import { VendorFormDialog } from "@/app/(app)/vendors/vendor-form-dialog"
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
  dataColumns,
  paginateVendors,
  paginationItems,
  sortVendors,
  vendorRangeLabel,
  type ColumnId,
  type SortState,
  type VendorSummary,
} from "@/lib/vendor-summary"
import { cn } from "@/lib/utils"

const pillClassName = "h-7 gap-1.5 rounded-full px-2.5 text-sm font-medium"

export function VendorsTable({
  vendors,
  categories,
  error,
}: {
  vendors: VendorSummary[]
  categories: string[]
  error: string | null
}) {
  const [sort, setSort] = useState<SortState>({
    key: "displayName",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formVendor, setFormVendor] = useState<VendorSummary | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<VendorSummary | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const columnCount = dataColumns.length + 1
  const sorted = useMemo(() => sortVendors(vendors, sort), [vendors, sort])
  const pageResult = useMemo(
    () => paginateVendors(sorted, page),
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

  function openForm(vendor: VendorSummary | null) {
    setFormVendor(vendor)
    setFormSession((current) => current + 1)
    setFormOpen(true)
  }

  function askDelete(vendor: VendorSummary) {
    setDeleteError(null)
    setPendingDelete(vendor)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteVendor(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this vendor.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Vendors</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/purchase-orders" />}
          >
            Purchase Orders
          </Button>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus aria-hidden="true" data-icon="inline-start" />
            Add New Vendor
          </Button>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {dataColumns.map((column) => {
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
                    className={cn(column.align === "right" && "text-right")}
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
                          column.align === "right" ? "-mr-2" : "-ml-2",
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
              <TableHead className="sticky right-0 z-10 w-16 bg-muted">
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
                  className="py-8 text-center whitespace-normal text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : pageResult.rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  className="py-8 text-center whitespace-normal text-muted-foreground"
                >
                  No vendors yet.
                </TableCell>
              </TableRow>
            ) : (
              pageResult.rows.map((vendor) => (
                <TableRow key={vendor.id} className="group">
                  {dataColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        column.align === "right" && "text-right",
                        (column.id === "displayName" ||
                          column.id === "contact") &&
                          "whitespace-normal",
                      )}
                    >
                      <CellValue vendor={vendor} columnId={column.id} />
                    </TableCell>
                  ))}
                  <TableCell className="sticky right-0 z-10 w-16 bg-card group-hover:bg-muted">
                    <RowActions
                      vendor={vendor}
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
            {vendorRangeLabel(
              pageResult.rangeStart,
              pageResult.rangeEnd,
              pageResult.total,
            )}
          </p>
          <Pagination
            aria-label="Vendors pagination"
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

      <VendorFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        vendor={formVendor}
        categories={categories}
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
            <AlertDialogTitle>Delete vendor</AlertDialogTitle>
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
  vendor,
  columnId,
}: {
  vendor: VendorSummary
  columnId: ColumnId
}) {
  switch (columnId) {
    case "displayName":
      return (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-medium",
              !vendor.displayName && "text-muted-foreground",
            )}
          >
            {vendor.displayName || "—"}
          </span>
          {vendor.vendorField ? (
            <Badge
              variant="outline"
              className={cn(pillClassName, "bg-card")}
            >
              {vendor.vendorField}
            </Badge>
          ) : null}
        </div>
      )
    case "contact":
      return <ContactValue vendor={vendor} />
    case "totalProjectValue":
    case "totalPaid":
    case "totalDue":
      return (
        <span className="tabular-nums">{formatMoney(vendor[columnId])}</span>
      )
  }
}

function ContactValue({ vendor }: { vendor: VendorSummary }) {
  const phone = vendor.phone?.trim() ?? ""
  const email = vendor.email?.trim() ?? ""

  if (!phone && !email) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {phone ? <span className="tabular-nums">{phone}</span> : null}
      {email ? (
        <span className={cn("break-all", phone && "text-muted-foreground")}>
          {email}
        </span>
      ) : null}
    </div>
  )
}

function RowActions({
  vendor,
  onEdit,
  onDelete,
}: {
  vendor: VendorSummary
  onEdit: (vendor: VendorSummary) => void
  onDelete: (vendor: VendorSummary) => void
}) {
  const label = vendor.displayName || "vendor"

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
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => onEdit(vendor)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(vendor)}
        >
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
