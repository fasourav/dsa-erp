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

import { deleteAsset } from "@/app/(app)/assets/actions"
import { AssetFormDialog } from "@/app/(app)/assets/asset-form-dialog"
import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
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
import type { AssetRow } from "@/lib/assets"
import { cn } from "@/lib/utils"

type ColId = "name" | "category" | "purchaseDate" | "quantity" | "totalCost" | "currentValue"

const columns: { id: ColId; label: string; align: "left" | "right" }[] = [
  { id: "name", label: "Name", align: "left" },
  { id: "category", label: "Category", align: "left" },
  { id: "purchaseDate", label: "Purchase Date", align: "left" },
  { id: "quantity", label: "Qty", align: "right" },
  { id: "totalCost", label: "Total Cost", align: "right" },
  { id: "currentValue", label: "Current Value", align: "right" },
]

function sortAssets(rows: AssetRow[], sort: SortState<ColId>): AssetRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case "name":
        cmp = a.name.localeCompare(b.name, "en", { sensitivity: "base" })
        break
      case "category":
        cmp = a.category.localeCompare(b.category, "en", { sensitivity: "base" })
        break
      case "purchaseDate":
        cmp = a.purchaseDate.localeCompare(b.purchaseDate)
        break
      case "quantity":
        cmp = a.quantity - b.quantity
        break
      case "totalCost":
        cmp = a.totalCost - b.totalCost
        break
      case "currentValue":
        cmp = a.currentValue - b.currentValue
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })
  return sorted
}

export function AssetsTable({
  assets,
  categories,
  error,
}: {
  assets: AssetRow[]
  categories: string[]
  error: string | null
}) {
  const [sort, setSort] = useState<SortState<ColId>>({
    key: "name",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formAsset, setFormAsset] = useState<AssetRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AssetRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(() => sortAssets(assets, sort), [assets, sort])
  const pageResult = useMemo(() => paginateRows(sorted, page), [sorted, page])
  const pages = paginationItems(pageResult.currentPage, pageResult.pageCount)

  function openForm(asset: AssetRow | null) {
    setFormAsset(asset)
    setFormSession((s) => s + 1)
    setFormOpen(true)
  }

  function askDelete(asset: AssetRow) {
    setDeleteError(null)
    setPendingDelete(asset)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteAsset(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }
        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this asset.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Assets</h1>
        <Button type="button" onClick={() => openForm(null)}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add New Asset
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
                    className={cn(col.align === "right" && "text-right")}
                  >
                    <div className={cn("flex", col.align === "right" && "justify-end")}>
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(col.align === "right" ? "-mr-2" : "-ml-2")}
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
                  No Assets Yet.
                </TableCell>
              </TableRow>
            ) : (
              pageResult.rows.map((asset) => (
                <TableRow key={asset.id} className="group">
                  <TableCell className="font-medium">{asset.name || "—"}</TableCell>
                  <TableCell>{asset.category || "—"}</TableCell>
                  <TableCell>
                    {asset.purchaseDate ? formatIsoDate(asset.purchaseDate) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {asset.quantity}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(asset.totalCost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(asset.currentValue)}
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 w-16 bg-card group-hover:bg-muted">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${asset.name}`}
                          />
                        }
                      >
                        <MoreHorizontal aria-hidden="true" className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem onClick={() => openForm(asset)}>
                          <Pencil aria-hidden="true" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => askDelete(asset)}
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
            {rangeLabel(pageResult.rangeStart, pageResult.rangeEnd, pageResult.total, "asset", "assets")}
          </p>
          <Pagination aria-label="Assets pagination" className="mx-0 w-auto justify-start sm:justify-end">
            <PaginationContent className="flex-wrap">
              <PaginationItem>
                <Button type="button" variant="ghost" disabled={pageResult.currentPage <= 1} aria-label="Go to previous page" onClick={() => setPage(pageResult.currentPage - 1)}>
                  <ChevronLeft aria-hidden="true" data-icon="inline-start" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
              </PaginationItem>
              {pages.map((item, index) =>
                item === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}><PaginationEllipsis /></PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <Button type="button" variant={item === pageResult.currentPage ? "outline" : "ghost"} size="icon" aria-label={`Page ${item}`} aria-current={item === pageResult.currentPage ? "page" : undefined} onClick={() => setPage(item)}>
                      {item}
                    </Button>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <Button type="button" variant="ghost" disabled={pageResult.currentPage >= pageResult.pageCount} aria-label="Go to next page" onClick={() => setPage(pageResult.currentPage + 1)}>
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight aria-hidden="true" data-icon="inline-end" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      <AssetFormDialog key={formSession} open={formOpen} onOpenChange={setFormOpen} asset={formAsset} categories={categories} />

      <AlertDialog open={deleteOpen} onOpenChange={(open) => { if (open || deleting) return; setDeleteOpen(false); setDeleteError(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Asset</AlertDialogTitle>
            <AlertDialogDescription>Are you sure to delete this item? If yes, Press and Hold</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? <p role="alert" className="text-sm text-destructive">{deleteError}</p> : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={deleting}>Cancel</AlertDialogCancel>
            <HoldToDeleteButton key={pendingDelete?.id} pending={deleting} onConfirm={confirmDelete} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
