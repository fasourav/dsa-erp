"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { FileText, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

import { ColumnHint, DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import {
  ListFilterBar,
  SettlementFilterControl,
} from "@/components/settlement-filter"
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
  unpaidSinceExplanation,
  type PayableColumnId,
  type PayableRow,
} from "@/lib/accounts-payable"
import { formatDayMonYear, formatIsoDate } from "@/lib/format"
import { sumBy } from "@/lib/payment-status"
import { cn } from "@/lib/utils"
import {
  paginateRows,
  rangeLabel,
  type SortState,
} from "@/lib/list-paging"
import {
  matchesSettlement,
  settlementCounts,
  type SettlementFilter,
} from "@/lib/settlement-filter"
import { useColumnVisibility } from "@/lib/use-column-visibility"
import { useListUrlState } from "@/lib/use-list-url-state"

const payableSortKeys = payableColumns.map((column) => column.id)
const defaultSort: SortState<PayableColumnId> = {
  key: "vendorName",
  direction: "asc",
}

function payableSearchText(row: PayableRow): string {
  return rowText({
    id: row.id,
    vendorName: row.vendorName,
    workType: row.workType,
    projectId: row.projectId,
    projectName: row.projectName,
    purchaseOrderId: row.purchaseOrderId,
    totalPayable: row.totalPayable,
    totalPaid: row.totalPaid,
    pendingPayable: row.pendingPayable,
    oldestUnpaidBillOn: row.oldestUnpaidBillOn ?? "",
  })
}

export function PayableTable({
  rows,
  error,
}: {
  rows: PayableRow[]
  error: string | null
  initialQuery?: string
  page?: number
  statusFilter?: SettlementFilter
  sort?: SortState<PayableColumnId>
}) {
  const visibility = useColumnVisibility(payableColumnStore)
  const {
    query,
    setQuery,
    settlement: statusFilter,
    setSettlement,
    sort,
    onSort,
    page,
    setPage,
  } = useListUrlState<PayableColumnId>({
    sortKeys: payableSortKeys,
    defaultSort,
    settlement: true,
  })
  const normalizedQuery = query.trim()
  const searched = useMemo(
    () => filterRows(error ? [] : rows, normalizedQuery, payableSearchText),
    [error, normalizedQuery, rows],
  )
  const counts = useMemo(
    () => settlementCounts(searched, (row) => row.settlement),
    [searched],
  )
  const visible = useMemo(
    () =>
      sortPayables(
        searched.filter((row) => matchesSettlement(row.settlement, statusFilter)),
        sort,
      ),
    [searched, sort, statusFilter],
  )
  const pageResult = paginateRows(visible, page)
  const totals = useMemo(
    () => ({
      values: {
        totalPayable: sumBy(visible, (row) => row.totalPayable),
        totalPaid: sumBy(visible, (row) => row.totalPaid),
        pendingPayable: sumBy(visible, (row) => row.pendingPayable),
      },
      withheld: visible.some((row) => row.settlement === null),
    }),
    [visible],
  )

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Accounts Payable"
        description="Open vendor bills by purchase order: billed, paid and still to pay. Unbilled order value isn't a payable yet. Matches the reports and dashboard."
        className="mb-0 md:mb-2"
        actions={
          <ListExport
            grid={{
              filename: "accounts-payable",
              title: "Accounts Payable",
              columns: [
                { header: "Project", kind: "text" },
                { header: "Vendor", kind: "text" },
                { header: "Unpaid Since", kind: "text" },
                { header: "Billed", kind: "money" },
                { header: "Paid", kind: "money" },
                { header: "Open Payable", kind: "money" },
              ],
              rows: visible.map((row) => [
                row.projectName,
                row.vendorName,
                row.oldestUnpaidBillOn ? formatDayMonYear(row.oldestUnpaidBillOn) : "—",
                row.totalPayable,
                row.totalPaid,
                row.pendingPayable,
              ]),
            }}
          />
        }
      />
      <ListFilterBar
        search={
          <ListSearch
            query={query}
            onQueryChange={setQuery}
            placeholder="Search payables"
          />
        }
        filter={
          <SettlementFilterControl
            value={statusFilter}
            counts={counts}
            label="Accounts payable settlement"
            onChange={setSettlement}
          />
        }
      />
      <DataList
        columns={payableColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(row) => row.id}
        sort={sort}
        onSort={onSort}
        visibility={visibility}
        error={error}
        totals={totals}
        emptyMessage={
          counts.all === 0 && !query.trim()
            ? "No Payables Yet."
            : "No Matching Payables."
        }
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
        mobileItem={(row) => ({
          title: row.purchaseOrderId ? (
            <Link
              href={`/purchase-orders/${row.purchaseOrderId}`}
              className="block truncate underline-offset-4 hover:underline"
            >
              {row.vendorName || "—"}
            </Link>
          ) : (
            row.vendorName || "—"
          ),
          subtitle: [
            row.projectName || "—",
            `Unpaid Since ${row.oldestUnpaidBillOn ? formatIsoDate(row.oldestUnpaidBillOn) : "—"}`,
          ].join(" · "),
          subtitleAccessory: (
            <ColumnHint label="Unpaid Since" hint={unpaidSinceExplanation} />
          ),
          meta: (
            <Money
              value={row.pendingPayable}
              className={
                row.pendingPayable > 0 ? "text-destructive" : "text-muted-foreground"
              }
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
      return row.vendorName ? (
        <span>{row.vendorName}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "oldestUnpaidBillOn":
      return (
        <span className="text-muted-foreground">
          {row.oldestUnpaidBillOn ? formatIsoDate(row.oldestUnpaidBillOn) : "—"}
        </span>
      )
    case "totalPayable":
      return <Money value={row.totalPayable} />
    case "totalPaid":
      return (
        <Money
          value={row.totalPaid}
          className={row.totalPaid > 0 ? "text-success" : "text-muted-foreground"}
        />
      )
    case "pendingPayable":
      return (
        <Money
          value={row.pendingPayable}
          className={
            row.pendingPayable > 0 ? "text-destructive" : "text-muted-foreground"
          }
        />
      )
  }
}
