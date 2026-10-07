"use client"

import { useMemo, useState } from "react"

import { DataList } from "@/components/data-list"
import { Badge } from "@/components/ui/badge"
import { formatMoney } from "@/lib/format"
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

const pillClassName = "h-7 gap-1.5 rounded-full px-2.5 text-sm font-medium"

export function ExpenseTable({
  rows,
  error,
}: {
  rows: PoExpenseRow[]
  error: string | null
}) {
  const visibility = useColumnVisibility(poExpenseColumnStore)
  const [sort, setSort] = useState<SortState<PoExpenseColumnId>>({
    key: "projectName",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => sortPoExpenses(rows, sort), [rows, sort])
  const pageResult = paginateRows(sorted, page)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">Expense</h1>
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
        columnLayout="even"
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
    case "projectName":
      return row.projectName ? (
        <span className="font-medium">{row.projectName}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "vendorName":
      return row.vendorName ? (
        <Badge variant="outline" className={cn(pillClassName, "bg-card")}>
          {row.vendorName}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "expenseAmount":
      return (
        <span className="tabular-nums">{formatMoney(row.expenseAmount)}</span>
      )
    case "bankingChannel":
      return row.bankingChannel ? (
        <span>{row.bankingChannel}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}
