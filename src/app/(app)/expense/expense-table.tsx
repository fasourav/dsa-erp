"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useMemo, useState } from "react"

import { DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { formatIsoDate } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { poExpenseColumnStore } from "@/lib/po-expense-column-store"
import {
  poExpenseColumns,
  sortPoExpenses,
  type PoExpenseColumnId,
  type PoExpenseRow,
} from "@/lib/po-expenses"
import { useColumnVisibility } from "@/lib/use-column-visibility"
import { cn } from "@/lib/utils"

export function ExpenseTable({
  rows,
  error,
}: {
  rows: PoExpenseRow[]
  error: string | null
}) {
  const visibility = useColumnVisibility(poExpenseColumnStore)
  const [sort, setSort] = useState<SortState<PoExpenseColumnId>>({
    key: "expenseDate",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const sorted = useMemo(() => sortPoExpenses(rows, sort), [rows, sort])
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = paginateRows(filtered, page)

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Expense"
        className="mb-0 md:mb-2"
        actions={
          <ListExport
            grid={{
              filename: "expense",
              title: "Expense",
              columns: [
                { header: "Date", kind: "text" },
                { header: "Project", kind: "text" },
                { header: "Vendor", kind: "text" },
                { header: "Work Type", kind: "text" },
                { header: "Expense", kind: "money" },
                { header: "Banking Channel", kind: "text" },
              ],
              rows: filtered.map((row) => [
                row.expenseDate ? formatIsoDate(row.expenseDate) : "",
                row.projectName,
                row.vendorName,
                row.workType,
                row.expenseAmount,
                row.bankingChannel,
              ]),
            }}
          />
        }
      />
      <ListSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        placeholder="Search expenses"
      />
      <DataList
        columns={poExpenseColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(row) => row.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
          setPage(1)
        }}
        visibility={visibility}
        error={error}
        emptyMessage="No Paid Expenses Yet."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "expense",
          "expenses",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Expense pagination"
        mobileItem={(row) => ({
          title: row.vendorName || "—",
          subtitle: [row.workType, row.projectName, row.expenseDate ? formatIsoDate(row.expenseDate) : "", row.bankingChannel]
            .filter(Boolean)
            .join(" · "),
          meta: <Money value={row.expenseAmount} />,
        })}
        renderCell={(row, columnId) => <Cell row={row} columnId={columnId} />}
      />
    </div>
  )
}

function Cell({
  row,
  columnId,
}: {
  row: PoExpenseRow
  columnId: PoExpenseColumnId
}) {
  switch (columnId) {
    case "expenseDate":
      return row.expenseDate ? (
        formatIsoDate(row.expenseDate)
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "projectName":
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
    case "vendorName":
      return (
        <span className="flex min-w-0 flex-col">
          <span className={cn("truncate", !row.vendorName && "text-muted-foreground")}>
            {row.vendorName || "—"}
          </span>
          {row.workType ? (
            <span className="truncate text-caption text-muted-foreground">{row.workType}</span>
          ) : null}
        </span>
      )
    case "expenseAmount":
      return <Money value={row.expenseAmount} />
    case "bankingChannel":
      return row.bankingChannel ? (
        <span>{row.bankingChannel}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}
