"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { FileText, MoreHorizontal } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

import { CustomizeColumns, DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { RecordLink } from "@/components/record-link"
import {
  ListFilterBar,
  SettlementFilterControl,
} from "@/components/settlement-filter"
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
  CLIENT_PAGE_SIZES,
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

const locked = new Set<ReceivableColumnId>(["projectName", "clientName"])
const receivableSortKeys = receivableColumns.map((column) => column.id)

const defaultSort: SortState<ReceivableColumnId> = {
  key: "projectName",
  direction: "asc",
}

function receivableSearchText(row: ReceivableRow): string {
  return rowText({
    id: row.id,
    clientName: row.clientName,
    projectId: row.projectId,
    projectName: row.projectName,
    billedAmount: row.billedAmount,
    paid: row.paid,
    due: row.due,
    status: row.status ?? "",
  })
}

export function ReceivableTable({
  rows,
  error,
}: {
  rows: ReceivableRow[]
  error: string | null
  initialQuery?: string
  page?: number
  statusFilter?: SettlementFilter
  sort?: SortState<ReceivableColumnId>
}) {
  const visibility = useColumnVisibility(receivableColumnStore)
  const {
    query,
    setQuery,
    settlement: statusFilter,
    setSettlement,
    sort,
    onSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    clearFilters,
  } = useListUrlState<ReceivableColumnId>({
    sortKeys: receivableSortKeys,
    defaultSort,
    settlement: true,
  })
  const normalizedQuery = query.trim()
  const searched = useMemo(
    () => filterRows(error ? [] : rows, normalizedQuery, receivableSearchText),
    [error, normalizedQuery, rows],
  )
  const counts = useMemo(
    () => settlementCounts(searched, (row) => row.settlement),
    [searched],
  )
  const visible = useMemo(
    () =>
      sortReceivables(
        searched.filter((row) => matchesSettlement(row.settlement, statusFilter)),
        sort,
      ),
    [searched, sort, statusFilter],
  )
  const pageResult = paginateRows(visible, page, pageSize)

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
                rows: visible.map((row) => [
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
      <ListFilterBar
        search={
          <ListSearch
            query={query}
            onQueryChange={setQuery}
            placeholder="Search receivables"
          />
        }
        filter={
          <SettlementFilterControl
            value={statusFilter}
            counts={counts}
            label="Accounts receivable settlement"
            onChange={setSettlement}
          />
        }
      />
      <DataList
        columns={receivableColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(row) => row.id}
        sort={sort}
        onSort={onSort}
        visibility={visibility}
        error={error}
        emptyMessage={
          counts.all === 0 && !query.trim()
            ? "No Receivable Invoices Yet."
            : "No Matching Receivables."
        }
        emptyState={
          counts.all === 0 && !query.trim()
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
        pagingLabel="Accounts Receivable pagination"
        mobileItem={(row) => ({
          title: row.projectId ? (
            <RecordLink
              href={`/accounts/invoices?project=${row.projectId}`}
              className="block truncate underline-offset-4 hover:underline"
            >
              {row.projectName || "—"}
            </RecordLink>
          ) : (
            row.projectName || "—"
          ),
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
                    prefetch={false}
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
      if (row.projectId) {
        return (
          <RecordLink
            href={`/accounts/invoices?project=${row.projectId}`}
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
