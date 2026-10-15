"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { FileText, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { CustomizeColumns, DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
import { paymentStatusLabel } from "@/lib/payment-status"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { receivableColumnStore } from "@/lib/accounts-receivable-column-store"
import {
  receivableColumns,
  sortReceivables,
  type ReceivableColumnId,
  type ReceivableRow,
} from "@/lib/accounts-receivable"
import { cn } from "@/lib/utils"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { useColumnVisibility } from "@/lib/use-column-visibility"

const locked = new Set<ReceivableColumnId>(["projectName", "clientName"])

export function ReceivableTable({
  rows,
  error,
}: {
  rows: ReceivableRow[]
  error: string | null
}) {
  const visibility = useColumnVisibility(receivableColumnStore)
  const [sort, setSort] = useState<SortState<ReceivableColumnId>>({
    key: "projectName",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const sorted = useMemo(() => sortReceivables(rows, sort), [rows, sort])
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = paginateRows(filtered, page)

  function changeVisibility(id: ReceivableColumnId, checked: boolean) {
    if (locked.has(id)) {
      return
    }

    receivableColumnStore.write({ ...visibility, [id]: checked })
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Accounts Receivable"
        description="Open invoice balances today. Reports show the balance on the chosen date."
        className="mb-0 md:mb-2"
        actions={
          <>
            <ListExport
              grid={{
                filename: "accounts-receivable",
                title: "Accounts Receivable",
                columns: [
                  { header: "Project", kind: "text" },
                  { header: "Client", kind: "text" },
                  { header: "Billed Amount", kind: "money" },
                  { header: "Total Paid", kind: "money" },
                  { header: "Pending Due", kind: "money" },
                  { header: "Status", kind: "text" },
                ],
                rows: filtered.map((row) => [
                  row.projectName,
                  row.clientName,
                  row.billedAmount,
                  row.paid,
                  row.due,
                  row.status ? paymentStatusLabel(row.status) : "—",
                ]),
              }}
            />
            <CustomizeColumns
              columns={receivableColumns}
              visibility={visibility}
              onVisibilityChange={changeVisibility}
            />
          </>
        }
      />
      <ListSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        placeholder="Search receivables"
      />
      <DataList
        columns={receivableColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(row) => row.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
          setPage(1)
        }}
        visibility={visibility}
        error={error}
        emptyMessage="No Receivable Invoices Yet."
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
        pagingLabel="Accounts Receivable pagination"
        mobileItem={(row) => ({
          title: row.projectName || "—",
          value: row.status ? <StatusBadge status={row.status} /> : undefined,
          subtitle: row.clientName || "—",
          meta: (
            <Money
              value={row.due}
              className={row.due > 0 ? "text-destructive" : "text-muted-foreground"}
            />
          ),
        })}
        renderCell={(row, columnId) => <Cell row={row} columnId={columnId} />}
        renderActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${row.clientName || "receivable"}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                nativeButton={false}
                disabled={!row.projectId}
                render={
                  <Link
                    href={
                      row.projectId
                        ? `/accounts/invoices?project=${row.projectId}`
                        : "/accounts/invoices"
                    }
                  />
                }
              >
                <FileText aria-hidden="true" />
                Client Invoices
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </div>
  )
}

function Cell({
  row,
  columnId,
}: {
  row: ReceivableRow
  columnId: ReceivableColumnId
}) {
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
    case "clientName":
      return row.clientName ? (
        <span>{row.clientName}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "billedAmount":
      return <Money value={row.billedAmount} />
    case "paid":
      return (
        <Money
          value={row.paid}
          className={row.paid > 0 ? "text-success" : "text-muted-foreground"}
        />
      )
    case "due":
      return (
        <Money
          value={row.due}
          className={row.due > 0 ? "text-destructive" : "text-muted-foreground"}
        />
      )
    case "status":
      return row.status ? (
        <StatusBadge status={row.status} />
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}
