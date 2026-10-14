"use client"

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Inbox,
} from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
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

type ColumnAlign = ListColumn<string>["align"]

function alignClass(align: ColumnAlign) {
  if (align === "right") {
    return "text-right"
  }

  if (align === "center") {
    return "text-center"
  }

  return "text-left"
}

function insetClass(
  align: ColumnAlign,
  previous: ColumnAlign | null,
  next: ColumnAlign | null,
) {
  return cn(
    "px-3",
    align === "right" && next && next !== "right" && "pr-6",
    previous === "right" && align !== "right" && "pl-6",
  )
}

function staysOnOneLine(column: {
  id: string
  label: string
  align: ColumnAlign
}) {
  if (column.align !== "left") {
    return true
  }

  return (
    /date/i.test(column.id) ||
    /date/i.test(column.label) ||
    /On$/.test(column.id)
  )
}

export type DataListMobileItem = {
  title: ReactNode
  subtitle?: ReactNode
  /** Right side of the first line, usually a <Money>. */
  value?: ReactNode
  /** Right side of the second line: a <StatusBadge>, or the amount when it reads with the subtitle. */
  meta?: ReactNode
}

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
  mobileItem,
  toolbar,
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
  /**
   * Phone list-card row. When set, phones get the Atrium grouped list and the
   * table only renders from md up. Without it phones scroll the table sideways.
   */
  mobileItem?: (row: T) => DataListMobileItem
  toolbar?: ReactNode
}) {
  const visibleColumns = columns.filter((column) =>
    columnVisible(column, visibility),
  )
  const hasActions = renderActions !== undefined
  const pages = paginationItems(currentPage, pageCount)

  return (
    <div className="flex flex-col gap-2.5 md:gap-3.5">
      {toolbar ? (
        <div className="flex flex-wrap items-center gap-2 px-1 md:gap-2.5 md:px-0">{toolbar}</div>
      ) : null}
      {mobileItem ? (
        <div className="flex flex-col gap-2.5 md:hidden">
          <div className="overflow-hidden rounded-card glass-panel">
            {error ? (
              <p role="alert" className="px-4 py-8 text-center text-callout text-destructive">
                {error}
              </p>
            ) : rows.length === 0 ? (
              <ListEmpty message={emptyMessage} />
            ) : (
              <ul>
                {rows.map((row) => {
                  const item = mobileItem(row)
                  return (
                    <li
                      key={rowKey(row)}
                      className={cn(
                        "relative flex min-h-16 items-center gap-3 py-3.25 pl-4",
                        hasActions ? "pr-2" : "pr-4",
                        "not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-4 not-first:before:h-px not-first:before:origin-top not-first:before:scale-y-50 not-first:before:bg-border",
                      )}
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="flex items-center justify-between gap-2.5">
                          <span className="min-w-0 truncate text-row font-semibold">{item.title}</span>
                          {item.value ? (
                            <span className="shrink-0 text-callout font-strong tabular-nums">
                              {item.value}
                            </span>
                          ) : null}
                        </div>
                        {item.subtitle || item.meta ? (
                          <div className="mt-0.5 flex items-center justify-between gap-2.5">
                            <span className="min-w-0 flex-1 truncate text-label text-muted-foreground">
                              {item.subtitle}
                            </span>
                            {item.meta ? (
                              <span className="shrink-0 text-callout font-strong tabular-nums">{item.meta}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      {hasActions ? (
                        <span className="inline-flex shrink-0 items-center">{renderActions(row)}</span>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="flex items-center justify-between gap-3 px-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={currentPage <= 1}
              aria-label="Go to previous page"
              onClick={() => onPageChange(currentPage - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <p className="text-label text-muted-foreground">{rangeText}</p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={currentPage >= pageCount}
              aria-label="Go to next page"
              onClick={() => onPageChange(currentPage + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
      <div
        className={cn(
          "min-w-0 overflow-hidden rounded-card glass-panel",
          mobileItem && "hidden md:block",
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {visibleColumns.map((column, index) => {
                const active = sort.key === column.id
                const previous = visibleColumns[index - 1]?.align ?? null
                const next = visibleColumns[index + 1]?.align ?? null
                const SortIcon = sort.direction === "asc" ? ArrowUp : ArrowDown
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
                      "py-2 align-middle",
                      alignClass(column.align),
                      insetClass(column.align, previous, next),
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-auto min-h-8 gap-1 rounded-md px-0 text-caption font-label text-muted-foreground hover:bg-transparent hover:text-foreground active:not-aria-[haspopup]:scale-100 md:h-auto md:px-0 md:text-caption",
                        column.align === "right" && "flex-row-reverse",
                        active && "text-foreground",
                      )}
                      aria-label={
                        active
                          ? `Sort by ${column.label}, ${sort.direction === "asc" ? "ascending" : "descending"}`
                          : `Sort by ${column.label}`
                      }
                      onClick={() => onSort(column.id)}
                    >
                      {column.label}
                      {active ? <SortIcon aria-hidden="true" className="size-3" strokeWidth={2.4} /> : null}
                    </Button>
                  </TableHead>
                )
              })}
              {hasActions ? (
                <TableHead className="sticky right-0 z-10 w-px bg-muted px-3 align-middle whitespace-nowrap last:pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {error || rows.length === 0 ? null : (
              rows.map((row) => (
                <TableRow key={rowKey(row)} className="group">
                  {visibleColumns.map((column, index) => {
                    const previous = visibleColumns[index - 1]?.align ?? null
                    const next = visibleColumns[index + 1]?.align ?? null
                    const oneLine = staysOnOneLine(column)
                    return (
                      <TableCell
                        key={column.id}
                        className={cn(
                          "align-middle",
                          oneLine ? "whitespace-nowrap" : "whitespace-normal",
                          alignClass(column.align),
                          insetClass(column.align, previous, next),
                          column.align !== "left" && "tabular-nums",
                        )}
                      >
                        <span
                          className={cn(
                            "max-w-full items-start [&_[data-slot=button]]:px-0 [&_[data-slot=button]]:md:px-0",
                            oneLine ? "inline-flex items-center" : "flex w-full min-w-0",
                          )}
                        >
                          {renderCell(row, column.id)}
                        </span>
                      </TableCell>
                    )
                  })}
                  {hasActions ? (
                    <TableCell className="sticky right-0 z-10 w-px bg-card px-3 py-2 align-middle whitespace-nowrap group-hover:bg-linear-to-r group-hover:from-primary-tint group-hover:to-primary-tint last:pr-4">
                      <span className="inline-flex items-center">
                        {renderActions(row)}
                      </span>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {error ? (
          <p role="alert" className="px-4 py-10 text-center text-callout text-destructive md:text-ui">
            {error}
          </p>
        ) : rows.length === 0 ? (
          <ListEmpty message={emptyMessage} />
        ) : null}
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:py-3 md:pr-4.5 md:pl-6">
          <p className="text-label text-muted-foreground">{rangeText}</p>
          <Pagination
            aria-label={pagingLabel}
            className="mx-0 w-auto justify-start sm:justify-end"
          >
            <PaginationContent className="flex-wrap gap-1">
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
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
                      variant="ghost"
                      size="icon"
                      aria-label={`Page ${item}`}
                      aria-current={item === currentPage ? "page" : undefined}
                      className="font-label text-muted-foreground aria-[current=page]:bg-solid aria-[current=page]:text-foreground aria-[current=page]:shadow-segment md:size-8"
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
                  size="sm"
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

function ListEmpty({ message }: { message: string }) {
  return (
    <Empty>
      <EmptyMedia variant="icon">
        <Inbox aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle className="font-label text-muted-foreground">{message}</EmptyTitle>
    </Empty>
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
      <DropdownMenuContent align="start" sideOffset={8} className="w-64">
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
