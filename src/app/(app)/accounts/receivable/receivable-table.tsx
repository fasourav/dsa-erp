"use client"

import { FileText, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { AgingSummary } from "@/components/aging-summary"
import { CustomizeColumns, DataList } from "@/components/data-list"
import { PaymentStatusBadge } from "@/components/payment-status-badge"
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
import type { AgingSummaryRow } from "@/lib/aging"
import { formatCount, formatIsoDate, formatMoney } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { useColumnVisibility } from "@/lib/use-column-visibility"

const locked = new Set<ReceivableColumnId>(["clientName", "projectName"])

export function ReceivableTable({
  rows,
  aging,
  error,
}: {
  rows: ReceivableRow[]
  aging: AgingSummaryRow[]
  error: string | null
}) {
  const visibility = useColumnVisibility(receivableColumnStore)
  const [sort, setSort] = useState<SortState<ReceivableColumnId>>({
    key: "dueDate",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => sortReceivables(rows, sort), [rows, sort])
  const pageResult = paginateRows(sorted, page)

  function changeVisibility(id: ReceivableColumnId, checked: boolean) {
    if (locked.has(id)) {
      return
    }

    receivableColumnStore.write({ ...visibility, [id]: checked })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">
          Accounts receivable
        </h1>
        <p className="text-sm text-muted-foreground">
          Open invoices clients still owe. Record invoices and payments from
          Client invoices.
        </p>
      </div>
      <AgingSummary rows={aging} emptyLabel="No aging buckets yet." />
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
        emptyMessage="No receivable invoices yet."
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
        pagingLabel="Accounts receivable pagination"
        toolbar={
          <CustomizeColumns
            columns={receivableColumns}
            visibility={visibility}
            onVisibilityChange={changeVisibility}
          />
        }
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
                Client invoices
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
    case "clientName":
    case "projectName":
      return row[columnId] ? (
        <span className="font-medium">{row[columnId]}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "issuedOn":
    case "dueDate":
      return row[columnId] ? (
        <span>{formatIsoDate(row[columnId])}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "agingBucket":
      return row.agingBucket ? (
        <span>{row.agingBucket}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "daysPastDue":
      return (
        <span className="tabular-nums">
          {row.daysPastDue === null ? "—" : formatCount(row.daysPastDue)}
        </span>
      )
    case "billedAmount":
    case "paid":
    case "due":
      return <span className="tabular-nums">{formatMoney(row[columnId])}</span>
    case "status":
      return row.status ? (
        <PaymentStatusBadge status={row.status} />
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}
