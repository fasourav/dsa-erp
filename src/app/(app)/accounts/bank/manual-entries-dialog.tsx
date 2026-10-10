"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

import { DataList } from "@/components/data-list"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { bankSourceLabel, type BankTransactionRow } from "@/lib/bank"
import { formatExactBdt } from "@/lib/dashboard-metrics"
import { formatIsoDate } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

type ColumnId =
  | "transactionDate"
  | "type"
  | "accountName"
  | "amount"
  | "paymentMethod"
  | "notes"

const columns: readonly ListColumn<ColumnId>[] = [
  { id: "transactionDate", label: "Date", align: "left", locked: true },
  { id: "type", label: "Type", align: "left", locked: true },
  { id: "accountName", label: "Bank Account", align: "left", locked: true },
  { id: "amount", label: "Amount", align: "right", locked: true },
  { id: "paymentMethod", label: "Payment Method", align: "left", locked: true },
  { id: "notes", label: "Notes", align: "left", locked: true },
]

export function ManualEntriesDialog({
  open,
  onOpenChange,
  rows,
  onEdit,
  onDelete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: readonly BankTransactionRow[]
  onEdit: (row: BankTransactionRow) => void
  onDelete: (row: BankTransactionRow) => void
}) {
  const [sort, setSort] = useState<SortState<ColumnId>>({
    key: "transactionDate",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort])
  const pageResult = paginateRows(sorted, page)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-4xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>Deposits & Withdrawals</DialogTitle>
        </DialogHeader>
        <DialogBody className="overflow-x-auto">
          <DataList
            columns={columns}
            rows={pageResult.rows}
            rowKey={(row) => row.id}
            sort={sort}
            onSort={(key) => {
              setSort((current) => toggleSort(current, key))
              setPage(1)
            }}
            visibility={{}}
            error={null}
            emptyMessage="No Deposits Or Withdrawals Yet."
            rangeText={rangeLabel(
              pageResult.rangeStart,
              pageResult.rangeEnd,
              pageResult.total,
              "entry",
              "entries",
            )}
            currentPage={pageResult.currentPage}
            pageCount={pageResult.pageCount}
            onPageChange={setPage}
            pagingLabel="Deposits and withdrawals pagination"
            renderCell={(row, columnId) => (
              <EntryCell row={row} columnId={columnId} />
            )}
            renderActions={(row) => (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Actions for ${bankSourceLabel(row.sourceKind)} on ${row.transactionDate || "an unknown date"}`}
                    />
                  }
                >
                  <MoreHorizontal aria-hidden="true" className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem onClick={() => onEdit(row)}>
                    <Pencil aria-hidden="true" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => onDelete(row)}>
                    <Trash2 aria-hidden="true" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          />
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            Close
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EntryCell({
  row,
  columnId,
}: {
  row: BankTransactionRow
  columnId: ColumnId
}) {
  switch (columnId) {
    case "transactionDate":
      return row.transactionDate ? (
        <span>{formatIsoDate(row.transactionDate)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "type":
      return <span>{bankSourceLabel(row.sourceKind)}</span>
    case "accountName":
      return row.accountName ? (
        <span className="font-medium">{row.accountName}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "amount":
      return <span className="tabular-nums">{formatExactBdt(row.amount)}</span>
    case "paymentMethod":
      return row.paymentMethod ? (
        <span>{row.paymentMethod}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "notes":
      return row.notes ? (
        <span className="block max-w-xs truncate" title={row.notes}>
          {row.notes}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}

function sortRows(
  rows: readonly BankTransactionRow[],
  sort: SortState<ColumnId>,
): BankTransactionRow[] {
  const direction = sort.direction === "asc" ? 1 : -1
  return [...rows].sort((left, right) => {
    const primary = compare(left, right, sort.key) * direction
    return primary === 0 ? left.id.localeCompare(right.id) : primary
  })
}

function compare(
  left: BankTransactionRow,
  right: BankTransactionRow,
  key: ColumnId,
): number {
  switch (key) {
    case "transactionDate":
      return left.transactionDate.localeCompare(right.transactionDate)
    case "type":
      return bankSourceLabel(left.sourceKind).localeCompare(
        bankSourceLabel(right.sourceKind),
        "en",
        { sensitivity: "base" },
      )
    case "accountName":
      return left.accountName.localeCompare(right.accountName, "en", {
        sensitivity: "base",
      })
    case "amount":
      return left.amount - right.amount
    case "paymentMethod":
      return left.paymentMethod.localeCompare(right.paymentMethod, "en", {
        sensitivity: "base",
      })
    case "notes":
      return left.notes.localeCompare(right.notes, "en", { sensitivity: "base" })
  }
}
