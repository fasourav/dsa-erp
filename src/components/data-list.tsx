"use client"

import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Inbox,
  Info,
} from "lucide-react"
import type {
  FocusEvent as ReactFocusEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  computeTableColumnLayout,
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
  dense: boolean,
) {
  if (dense) {
    return cn(
      "px-2.5 first:pl-5",
      align === "right" && next && next !== "right" && "pr-4",
      previous === "right" && align !== "right" && "pl-4",
    )
  }
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

function syncCellTitle(
  event: ReactMouseEvent<HTMLElement> | ReactFocusEvent<HTMLElement>,
) {
  const root = event.currentTarget
  if (root.querySelector("[title]")) {
    return
  }

  const candidates = [
    root,
    ...root.querySelectorAll<HTMLElement>("a, button, span, div, p"),
  ]
  const clipped = candidates.some(
    (node) => node.clientWidth > 0 && node.scrollWidth > node.clientWidth + 1,
  )

  if (clipped) {
    const text = root.textContent?.replace(/\s+/g, " ").trim() ?? ""
    if (text) {
      root.title = text
      root.dataset.autoTitle = "1"
    }
  } else if (root.dataset.autoTitle === "1") {
    root.removeAttribute("title")
    delete root.dataset.autoTitle
  }
}

export type DataListMobileItem = {
  title: ReactNode
  subtitle?: ReactNode
  /** Sits beside the subtitle and stays visible when the subtitle truncates. */
  subtitleAccessory?: ReactNode
  /** Right side of the first line, usually a <Money>. */
  value?: ReactNode
  /** Right side of the second line: a <StatusBadge>, or the amount when it reads with the subtitle. */
  meta?: ReactNode
}

const noopPageChange = () => {}

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
  currentPage = 1,
  pageCount = 1,
  onPageChange = noopPageChange,
  pagingLabel = "Pagination",
  hidePagination = false,
  renderCell,
  renderActions,
  mobileItem,
  toolbar,
  subtleScrollbar = false,
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
  currentPage?: number
  pageCount?: number
  onPageChange?: (page: number) => void
  pagingLabel?: string
  hidePagination?: boolean
  renderCell: (row: T, columnId: Id) => ReactNode
  renderActions?: (row: T) => ReactNode
  /**
   * Phone list-card row. When set, phones get the Atrium grouped list and the
   * table only renders from md up. Without it phones scroll the table sideways.
   */
  mobileItem?: (row: T) => DataListMobileItem
  toolbar?: ReactNode
  /**
   * Opt-in slim, theme-aware horizontal scrollbar for wide tables, shown on
   * hover or keyboard focus. Off by default so other tables keep the native
   * scrollbar.
   */
  subtleScrollbar?: boolean
}) {
  const visibleColumns = columns.filter((column) =>
    columnVisible(column, visibility),
  )
  const dense = visibleColumns.length >= 10
  const compactActions = dense || visibleColumns.length >= 6
  const hasActions = renderActions !== undefined
  const hasRows = !error && rows.length > 0
  const layout = computeTableColumnLayout(visibleColumns, { dense, hasActions })
  const pages = hidePagination ? [] : paginationItems(currentPage, pageCount)

  return (
    <div className="flex min-w-0 flex-col gap-2.5 md:gap-3.5">
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
                        {item.subtitle || item.subtitleAccessory || item.meta ? (
                          <div className="mt-0.5 flex items-center justify-between gap-2.5">
                            <span className="flex min-w-0 flex-1 items-center gap-1 text-label text-muted-foreground">
                              <span className="min-w-0 truncate">{item.subtitle}</span>
                              {item.subtitleAccessory ? (
                                <span className="shrink-0">{item.subtitleAccessory}</span>
                              ) : null}
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
          {hidePagination ? (
            <p className="px-1 text-label text-muted-foreground">{rangeText}</p>
          ) : (
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
          )}
        </div>
      ) : null}
      <div
        className={cn(
          "min-w-0 overflow-hidden rounded-card glass-panel",
          !hasRows && "[&_[data-slot=table-container]]:overflow-x-hidden",
          subtleScrollbar &&
            "[&_[data-slot=table-container]]:scrollbar-subtle [&_[data-slot=table-container]]:overflow-y-hidden",
          mobileItem && "hidden md:block",
        )}
      >
        <Table
          className="table-fixed"
          style={
            layout.minWidthPx > 0
              ? { minWidth: `${layout.minWidthPx}px` }
              : undefined
          }
        >
          <colgroup>
            {visibleColumns.map((column, index) => (
              <col
                key={column.id}
                style={{ width: layout.columnWidths[index] }}
              />
            ))}
            {hasActions ? (
              <col style={{ width: `${layout.actionsWidthPx}px` }} />
            ) : null}
          </colgroup>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {visibleColumns.map((column, index) => {
                const isSortable = column.sortable !== false
                const active = isSortable && sort.key === column.id
                const previous = visibleColumns[index - 1]?.align ?? null
                const next = visibleColumns[index + 1]?.align ?? null
                return (
                  <TableHead
                    key={column.id}
                    aria-sort={
                      isSortable
                        ? active
                          ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    className={cn(
                      "py-2 align-middle",
                      column.hint ? "overflow-visible" : "overflow-hidden",
                      alignClass(column.align),
                      insetClass(column.align, previous, next, dense),
                    )}
                  >
                    {column.hint ? (
                      <div
                        className={cn(
                          "flex max-w-full min-w-0 items-center gap-1",
                          column.align === "right" && "flex-row-reverse",
                        )}
                      >
                        <ColumnLabel
                          column={column}
                          sortable={isSortable}
                          active={active}
                          sortDirection={sort.direction}
                          onSort={() => onSort(column.id)}
                        />
                        <ColumnHint label={column.label} hint={column.hint} />
                      </div>
                    ) : (
                      <ColumnLabel
                        column={column}
                        sortable={isSortable}
                        active={active}
                        sortDirection={sort.direction}
                        onSort={() => onSort(column.id)}
                      />
                    )}
                  </TableHead>
                )
              })}
              {hasActions ? (
                <TableHead
                  className={cn(
                    "sticky right-0 z-10 border-l border-border-subtle bg-muted text-right align-middle whitespace-nowrap",
                    compactActions ? "w-14 px-1.5 last:pr-2.5" : "w-19 pr-3 pl-1.5 last:pr-4",
                  )}
                >
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
                          "overflow-hidden align-middle",
                          oneLine ? "whitespace-nowrap" : "whitespace-normal",
                          dense && "text-caption",
                          alignClass(column.align),
                          insetClass(column.align, previous, next, dense),
                          column.align !== "left" && "tabular-nums",
                        )}
                      >
                        <span
                          onMouseEnter={syncCellTitle}
                          onFocus={syncCellTitle}
                          className={cn(
                            "max-w-full min-w-0 [&_[data-slot=badge]]:max-w-full [&_[data-slot=badge]]:min-w-0 [&_[data-slot=badge]]:shrink [&_a:focus-visible]:ring-inset [&_[data-slot=button]]:max-w-full [&_[data-slot=button]]:min-w-0 [&_[data-slot=button]]:px-0 [&_[data-slot=button]]:md:px-0 [&_[data-slot=button]:focus-visible]:ring-inset [&_[data-slot=checkbox]]:shrink-0",
                            oneLine
                              ? "inline-flex items-center overflow-hidden"
                              : "block w-full leading-snug [&:not(:has(.flex-col,.flex-wrap,.line-clamp-2))]:truncate [&_.flex>*:not([data-slot=checkbox])]:min-w-0 [&_.flex-col>*:not([data-slot=badge])]:max-w-full [&_.flex-col>*:not([data-slot=badge])]:truncate [&_a]:max-w-full [&_a]:truncate [&_[data-slot=button]]:inline-block [&_[data-slot=button]]:truncate [&_[data-slot=button]]:text-left [&_[data-slot=button]]:leading-8 [&_[data-slot=button]]:align-middle [&_span.block]:truncate",
                          )}
                        >
                          {renderCell(row, column.id)}
                        </span>
                      </TableCell>
                    )
                  })}
                  {hasActions ? (
                    <TableCell
                      className={cn(
                        "sticky right-0 z-10 border-l border-border-subtle bg-card py-2 text-right align-middle whitespace-nowrap transition-colors group-hover:bg-[color-mix(in_srgb,var(--primary)_10%,var(--card))] group-has-aria-expanded:bg-[color-mix(in_srgb,var(--primary)_10%,var(--card))] group-data-[state=selected]:bg-[color-mix(in_srgb,var(--primary)_10%,var(--card))] dark:group-hover:bg-[color-mix(in_srgb,var(--primary)_16%,var(--card))] dark:group-has-aria-expanded:bg-[color-mix(in_srgb,var(--primary)_16%,var(--card))] dark:group-data-[state=selected]:bg-[color-mix(in_srgb,var(--primary)_16%,var(--card))]",
                        compactActions ? "w-14 px-1.5 last:pr-2.5" : "w-19 pr-3 pl-1.5 last:pr-4",
                      )}
                    >
                      <span className="inline-flex items-center justify-end [&_[data-slot=button]:not([class*='size-'])]:h-8 [&_[data-slot=button]:not([class*='size-'])]:px-2 [&_[data-slot=button]:not([class*='size-'])]:text-xs">
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
          {hidePagination ? null : (
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
          )}
        </div>
      </div>
    </div>
  )
}

function ColumnLabel<Id extends string>({
  column,
  sortable,
  active,
  sortDirection,
  onSort,
}: {
  column: ListColumn<Id>
  sortable: boolean
  active: boolean
  sortDirection: SortState<Id>["direction"]
  onSort: () => void
}) {
  const SortIcon = sortDirection === "asc" ? ArrowUp : ArrowDown

  if (!sortable) {
    return (
      <span
        className={cn(
          "inline-flex max-w-full min-h-8 min-w-0 items-center text-caption font-label text-muted-foreground",
          column.align === "right" && "justify-end",
          column.hint && "flex-1",
        )}
      >
        <span className="truncate">{column.label}</span>
      </span>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-auto max-w-full min-h-8 min-w-0 gap-1 rounded-md px-0 text-caption font-label text-muted-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-inset active:not-aria-[haspopup]:scale-100 md:h-auto md:px-0 md:text-caption",
        column.align === "right" && "flex-row-reverse",
        column.hint && "flex-1",
        active && "text-foreground",
      )}
      aria-label={
        active
          ? `Sort by ${column.label}, ${sortDirection === "asc" ? "ascending" : "descending"}`
          : `Sort by ${column.label}`
      }
      onClick={onSort}
    >
      <span className="truncate">{column.label}</span>
      {active ? <SortIcon aria-hidden="true" className="size-3 shrink-0" strokeWidth={2.4} /> : null}
    </Button>
  )
}

export function ColumnHint({ label, hint }: { label: string; hint: string }) {
  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={`About ${label}`}
              className="shrink-0 rounded-full text-subtle-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <Info aria-hidden="true" className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent arrow={false} className="max-w-64">
          <span className="block min-w-0 whitespace-normal text-left">{hint}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
