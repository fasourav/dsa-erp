"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useMemo } from "react"

import { DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { RecordLink } from "@/components/record-link"
import { Badge } from "@/components/ui/badge"
import { formatDayMonYear, formatIsoDate } from "@/lib/format"
import { incomeColumnStore } from "@/lib/income-column-store"
import {
  incomeColumns,
  sortIncome,
  type IncomeColumnId,
  type IncomeRow,
} from "@/lib/income"
import {
  CLIENT_PAGE_SIZES,
  paginateRows,
  rangeLabel,
  type SortState,
} from "@/lib/list-paging"
import { useColumnVisibility } from "@/lib/use-column-visibility"
import { useListUrlState } from "@/lib/use-list-url-state"
import { cn } from "@/lib/utils"

const incomeSortKeys = incomeColumns.map((column) => column.id)
const defaultIncomeSort: SortState<IncomeColumnId> = {
  key: "paidOn",
  direction: "desc",
}

export function IncomeTable({
  rows,
  error,
}: {
  rows: IncomeRow[]
  error: string | null
}) {
  const visibility = useColumnVisibility(incomeColumnStore)
  const {
    query,
    setQuery,
    sort,
    onSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    clearFilters,
    hasActiveFilters,
  } = useListUrlState<IncomeColumnId>({
    sortKeys: incomeSortKeys,
    defaultSort: defaultIncomeSort,
  })
  const sorted = useMemo(() => sortIncome(rows, sort), [rows, sort])
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = paginateRows(filtered, page, pageSize)

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Income"
        className="mb-0 md:mb-2"
        actions={
          <ListExport
            grid={{
              filename: "income",
              title: "Income",
              columns: [
                { header: "Project", kind: "text" },
                { header: "Project Type", kind: "text" },
                { header: "Invoice Amount", kind: "money" },
                { header: "Collected", kind: "money" },
                { header: "Banking Channel", kind: "text" },
                { header: "Paid Date", kind: "text" },
              ],
              rows: filtered.map((row) => [
                row.projectName,
                row.projectType,
                row.invoiceAmount,
                row.collectedAmount,
                row.bankingChannel,
                formatDayMonYear(row.paidOn),
              ]),
            }}
          />
        }
      />
      <ListSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Search income"
      />
      <DataList
        columns={incomeColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(row) => row.id}
        sort={sort}
        onSort={onSort}
        visibility={visibility}
        error={error}
        emptyMessage="No Collected Invoices Yet."
        emptyState={
          rows.length === 0 && !hasActiveFilters
            ? { kind: "none" }
            : { kind: "filtered", onClearFilters: clearFilters }
        }
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "invoice",
          "invoices",
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
        pagingLabel="Income pagination"
        mobileItem={(row) => ({
          title: row.projectId ? (
            <RecordLink
              href={`/projects/${row.projectId}`}
              className="block truncate underline-offset-4 hover:underline"
            >
              {row.projectName || "—"}
            </RecordLink>
          ) : (
            row.projectName || "—"
          ),
          value: (
            <Money
              value={row.collectedAmount}
              className={
                row.collectedAmount > 0 ? "text-success" : "text-muted-foreground"
              }
            />
          ),
          subtitle: [
            row.projectType,
            row.bankingChannel,
            row.paidOn ? formatIsoDate(row.paidOn) : "",
          ]
            .filter(Boolean)
            .join(" · "),
          detail: (
            <span>
              Invoice Amount{" "}
              <Money
                value={row.invoiceAmount}
                className={
                  row.invoiceAmount > 0 ? "text-success" : "text-muted-foreground"
                }
              />
            </span>
          ),
        })}
        renderCell={(row, columnId) => <Cell row={row} columnId={columnId} />}
      />
    </div>
  )
}

function Cell({ row, columnId }: { row: IncomeRow; columnId: IncomeColumnId }) {
  switch (columnId) {
    case "projectName":
      if (row.projectId) {
        return (
          <RecordLink
            href={`/projects/${row.projectId}`}
            className={cn(
              "block truncate rounded-sm text-ui font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
              !row.projectName && "text-muted-foreground",
            )}
          >
            {row.projectName || "—"}
          </RecordLink>
        )
      }
      return (
        <span
          className={cn(
            "text-ui font-semibold",
            !row.projectName && "text-muted-foreground",
          )}
        >
          {row.projectName || "—"}
        </span>
      )
    case "projectType":
      return row.projectType ? (
        <Badge variant="outline">{row.projectType}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "invoiceAmount":
      return (
        <Money
          value={row.invoiceAmount}
          className={row.invoiceAmount > 0 ? "text-success" : "text-muted-foreground"}
        />
      )
    case "collectedAmount":
      return (
        <Money
          value={row.collectedAmount}
          className={row.collectedAmount > 0 ? "text-success" : "text-muted-foreground"}
        />
      )
    case "bankingChannel":
      return row.bankingChannel ? (
        <span>{row.bankingChannel}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "paidOn":
      return row.paidOn ? (
        <span className="text-muted-foreground">{formatIsoDate(row.paidOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}
