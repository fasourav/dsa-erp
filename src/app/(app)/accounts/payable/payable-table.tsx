"use client"

import { FileText, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import { DataList } from "@/components/data-list"
import { paymentBalanceStatus, StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { payableColumnStore } from "@/lib/accounts-payable-column-store"
import {
  payableColumns,
  sortPayables,
  type PayableColumnId,
  type PayableRow,
} from "@/lib/accounts-payable"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { useColumnVisibility } from "@/lib/use-column-visibility"

const pillClassName = "h-7 gap-1.5 rounded-full px-2.5 text-sm font-medium"

export function PayableTable({
  rows,
  error,
}: {
  rows: PayableRow[]
  error: string | null
}) {
  const visibility = useColumnVisibility(payableColumnStore)
  const [sort, setSort] = useState<SortState<PayableColumnId>>({
    key: "vendorName",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => sortPayables(rows, sort), [rows, sort])
  const pageResult = paginateRows(sorted, page)

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">Accounts Payable</h1>
      <DataList
        columns={payableColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(row) => row.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
          setPage(1)
        }}
        visibility={visibility}
        error={error}
        emptyMessage="No Payables Yet."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "payable",
          "payables",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Accounts Payable pagination"
        renderCell={(row, columnId) => <Cell row={row} columnId={columnId} />}
        renderActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${row.vendorName || "payable"}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                nativeButton={false}
                disabled={!row.purchaseOrderId}
                render={
                  <Link
                    href={
                      row.purchaseOrderId
                        ? `/purchase-orders/${row.purchaseOrderId}`
                        : "/purchase-orders"
                    }
                  />
                }
              >
                <FileText aria-hidden="true" />
                Vendor Payments
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
  row: PayableRow
  columnId: PayableColumnId
}) {
  switch (columnId) {
    case "projectName":
      return row.projectName ? (
        <span className="font-medium">{row.projectName}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "vendorName":
      return <VendorValue row={row} />
    case "totalPayable":
    case "totalPaid":
    case "pendingPayable":
      return <span className="tabular-nums">{formatMoney(row[columnId])}</span>
  }
}

function VendorValue({ row }: { row: PayableRow }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span
          className={cn(
            "font-medium",
            !row.vendorName && "text-muted-foreground",
          )}
        >
          {row.vendorName || "—"}
        </span>
        {row.workType ? (
          <Badge variant="outline" className={cn(pillClassName, "bg-card")}>
            {row.workType}
          </Badge>
        ) : null}
      </div>
      <StatusBadge
        status={paymentBalanceStatus(row.totalPaid, row.pendingPayable)}
      />
    </div>
  )
}
