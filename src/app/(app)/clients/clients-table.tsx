"use client"

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { useMemo, useState, useSyncExternalStore, useTransition } from "react"

import { AddClientDialog } from "@/app/(app)/clients/add-client-dialog"
import { deleteClient } from "@/app/(app)/clients/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
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
  getColumnServerSnapshot,
  getColumnSnapshot,
  subscribeColumnVisibility,
  writeColumnVisibility,
} from "@/lib/client-column-store"
import {
  clientRangeLabel,
  dataColumns,
  isColumnVisible,
  isOptionalColumn,
  kindLabel,
  paginateClients,
  paginationItems,
  sortClients,
  type ClientSummary,
  type ColumnId,
  type SortState,
} from "@/lib/client-summary"
import { formatCount, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

export function ClientsTable({
  clients,
  error,
}: {
  clients: ClientSummary[]
  error: string | null
}) {
  const visibility = useSyncExternalStore(
    subscribeColumnVisibility,
    getColumnSnapshot,
    getColumnServerSnapshot,
  )
  const [sort, setSort] = useState<SortState>({
    key: "displayName",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<ClientSummary | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const visibleColumns = dataColumns.filter((column) =>
    isColumnVisible(column.id, visibility),
  )
  const columnCount = visibleColumns.length + 1
  const sorted = useMemo(() => sortClients(clients, sort), [clients, sort])
  const pageResult = useMemo(
    () => paginateClients(sorted, page),
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

  function askDelete(client: ClientSummary) {
    setDeleteError(null)
    setPendingDelete(client)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteClient(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setPendingDelete(null)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this client.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Clients</h1>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="outline" />}
            >
              <Columns3 aria-hidden="true" data-icon="inline-start" />
              Customize Columns
              <ChevronDown aria-hidden="true" data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {dataColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={
                    isOptionalColumn(column.id) ? visibility[column.id] : true
                  }
                  disabled={column.locked}
                  onCheckedChange={(checked) => {
                    if (!isOptionalColumn(column.id)) {
                      return
                    }

                    writeColumnVisibility({
                      ...visibility,
                      [column.id]: checked,
                    })
                  }}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <AddClientDialog />
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
                        <SortIcon
                          active={active}
                          direction={sort.direction}
                        />
                      </Button>
                    </div>
                  </TableHead>
                )
              })}
              <TableHead className="sticky right-0 z-10 w-16 border-l border-border bg-muted">
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
                  No clients yet.
                </TableCell>
              </TableRow>
            ) : (
              pageResult.rows.map((client) => (
                <TableRow key={client.id} className="group">
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(column.align === "right" && "text-right")}
                    >
                      <CellValue client={client} columnId={column.id} />
                    </TableCell>
                  ))}
                  <TableCell className="sticky right-0 z-10 w-16 border-l border-border bg-card group-hover:bg-muted">
                    <RowActions client={client} onDelete={askDelete} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {clientRangeLabel(
              pageResult.rangeStart,
              pageResult.rangeEnd,
              pageResult.total,
            )}
          </p>
          <Pagination
            aria-label="Clients pagination"
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

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (open || deleting) {
            return
          }

          setPendingDelete(null)
          setDeleteError(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.displayName
                ? `${pendingDelete.displayName} will be removed. This cannot be undone.`
                : "This client will be removed. This cannot be undone."}
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
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={confirmDelete}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CellValue({
  client,
  columnId,
}: {
  client: ClientSummary
  columnId: ColumnId
}) {
  switch (columnId) {
    case "displayName":
      return (
        <span
          className={cn(
            "font-medium",
            !client.displayName && "text-muted-foreground",
          )}
        >
          {client.displayName || "—"}
        </span>
      )
    case "kind":
      if (!client.kind) {
        return <span className="text-muted-foreground">—</span>
      }

      return (
        <Badge
          variant={client.kind === "company" ? "secondary" : "outline"}
          className="rounded-full"
        >
          {kindLabel(client.kind)}
        </Badge>
      )
    case "ongoingProjects":
    case "completedProjects":
    case "totalProjects":
      return <span className="tabular-nums">{formatCount(client[columnId])}</span>
    case "totalProjectValue":
    case "totalPaid":
    case "totalPending":
      return <span className="tabular-nums">{formatMoney(client[columnId])}</span>
  }
}

function RowActions({
  client,
  onDelete,
}: {
  client: ClientSummary
  onDelete: (client: ClientSummary) => void
}) {
  const label = client.displayName || "client"

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
        <DropdownMenuItem>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(client)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean
  direction: SortState["direction"]
}) {
  if (!active) {
    return (
      <ArrowUpDown
        aria-hidden="true"
        className="text-muted-foreground"
        data-icon="inline-end"
      />
    )
  }

  if (direction === "asc") {
    return <ArrowUp aria-hidden="true" data-icon="inline-end" />
  }

  return <ArrowDown aria-hidden="true" data-icon="inline-end" />
}

