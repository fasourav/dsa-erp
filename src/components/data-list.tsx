"use client"

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
} from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
  columnVisible,
  paginationItems,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import { cn } from "@/lib/utils"

export function DataList<T, Id extends string>({
  columns,
  rows,
  rowKey,
  sort,
  onSort,
  visibility,
  error,
  emptyMessage,
  rangeText,
  currentPage,
  pageCount,
  onPageChange,
  pagingLabel,
  renderCell,
  renderActions,
  toolbar,
  columnLayout = "auto",
}: {
  columns: readonly ListColumn<Id>[]
  rows: readonly T[]
  rowKey: (row: T) => string
  sort: SortState<Id>
  onSort: (id: Id) => void
  visibility: Partial<Record<Id, boolean>>
  error: string | null
  emptyMessage: string
  rangeText: string
  currentPage: number
  pageCount: number
  onPageChange: (page: number) => void
  pagingLabel: string
  renderCell: (row: T, columnId: Id) => ReactNode
  renderActions?: (row: T) => ReactNode
  toolbar?: ReactNode
  columnLayout?: "auto" | "even"
}) {
  const even = columnLayout === "even"
  const visibleColumns = columns.filter((column) =>
    columnVisible(column, visibility),
  )
  const hasActions = renderActions !== undefined
  const columnCount = visibleColumns.length + (hasActions ? 1 : 0)
  const pages = paginationItems(currentPage, pageCount)

  return (
    <div className="flex flex-col gap-4">
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
      ) : null}
      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <Table
          className={cn(
            even ? "min-w-max md:min-w-full md:table-fixed" : "min-w-max",
          )}
        >
          {even ? (
            <colgroup>
              {visibleColumns.map((column) => (
                <col key={column.id} />
              ))}
              {hasActions ? <col className="w-16" /> : null}
            </colgroup>
          ) : null}
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
                      even && "whitespace-normal",
                      column.align === "right" && "text-right",
                    )}
                  >
                    <div
                      className={cn(
                        "flex min-w-0",
                        column.align === "right" && "justify-end",
                      )}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          "border-0",
                          column.align === "right" ? "-mr-2.5 text-right" : "-ml-2.5 text-left",
                          even && "h-auto min-h-8 max-w-full min-w-0 shrink whitespace-normal",
                        )}
                        aria-label={
                          active
                            ? `Sort by ${column.label}, ${sort.direction === "asc" ? "ascending" : "descending"}`
                            : `Sort by ${column.label}`
                        }
                        onClick={() => onSort(column.id)}
                      >
                        {column.label}
                      </Button>
                    </div>
                  </TableHead>
                )
              })}
              {hasActions ? (
                <TableHead className="sticky right-0 z-10 w-16 bg-muted px-3">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
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
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columnCount}
                  className="px-3 py-8 text-center whitespace-normal text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={rowKey(row)} className="group">
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn(
                        "p-3 text-sm whitespace-normal",
                        column.align === "right" && "text-right tabular-nums",
                        even && column.align === "right" && "whitespace-nowrap",
                      )}
                    >
                      {renderCell(row, column.id)}
                    </TableCell>
                  ))}
                  {hasActions ? (
                    <TableCell className="sticky right-0 z-10 w-16 bg-card p-3 text-sm group-hover:bg-muted">
                      {renderActions(row)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">{rangeText}</p>
          <Pagination
            aria-label={pagingLabel}
            className="mx-0 w-auto justify-start sm:justify-end"
          >
            <PaginationContent className="flex-wrap">
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={currentPage <= 1}
                  aria-label="Go to previous page"
                  onClick={() => onPageChange(currentPage - 1)}
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
                      variant={item === currentPage ? "outline" : "ghost"}
                      size="icon"
                      aria-label={`Page ${item}`}
                      aria-current={item === currentPage ? "page" : undefined}
                      onClick={() => onPageChange(item)}
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
                  disabled={currentPage >= pageCount}
                  aria-label="Go to next page"
                  onClick={() => onPageChange(currentPage + 1)}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight aria-hidden="true" data-icon="inline-end" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  )
}

export function CustomizeColumns<Id extends string>({
  columns,
  visibility,
  onVisibilityChange,
}: {
  columns: readonly ListColumn<Id>[]
  visibility: Partial<Record<Id, boolean>>
  onVisibilityChange: (id: Id, checked: boolean) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" />}>
        <Columns3 aria-hidden="true" data-icon="inline-start" />
        Customize Columns
        <ChevronDown aria-hidden="true" data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.locked ? true : visibility[column.id] !== false}
            disabled={column.locked}
            onCheckedChange={(checked) => {
              if (column.locked) {
                return
              }

              onVisibilityChange(column.id, checked)
            }}
          >
            {column.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
