"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useMemo, useState } from "react"

import { DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
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
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { useColumnVisibility } from "@/lib/use-column-visibility"
import { cn } from "@/lib/utils"

export function IncomeTable({
  rows,
  error,
}: {
  rows: IncomeRow[]
  error: string | null
}) {
  const visibility = useColumnVisibility(incomeColumnStore)
  const [sort, setSort] = useState<SortState<IncomeColumnId>>({
    key: "paidOn",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const sorted = useMemo(() => sortIncome(rows, sort), [rows, sort])
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = paginateRows(filtered, page)

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
                { header: "Banking Channel", kind: "text" },
                { header: "Paid Date", kind: "text" },
              ],
              rows: filtered.map((row) => [
                row.projectName,
                row.projectType,
                row.invoiceAmount,
                row.bankingChannel,
                formatDayMonYear(row.paidOn),
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
        placeholder="Search income"
      />
      <DataList
        columns={incomeColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(row) => row.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
          setPage(1)
        }}
        visibility={visibility}
        error={error}
        emptyMessage="No Paid Invoices Yet."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "invoice",
          "invoices",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Income pagination"
        mobileItem={(row) => ({
          title: row.projectName || "—",
          subtitle: [row.bankingChannel, row.paidOn ? formatIsoDate(row.paidOn) : ""]
            .filter(Boolean)
            .join(" · "),
          meta: (
            <Money
              value={row.invoiceAmount}
              className={
                row.invoiceAmount > 0 ? "text-success" : "text-muted-foreground"
              }
            />
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
