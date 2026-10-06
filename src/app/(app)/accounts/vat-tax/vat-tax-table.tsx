"use client"

import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { VatTaxFormDialog } from "@/app/(app)/accounts/vat-tax/vat-tax-form-dialog"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  paginateRows,
  paginationItems,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { formatIsoDate, formatMoney } from "@/lib/format"
import type { BankAccountChoice } from "@/lib/bank-account"
import type { ProjectOption, VatTaxRow } from "@/lib/vat-tax"
import { cn } from "@/lib/utils"

type ColId = "projectName" | "paidOn" | "amount" | "paymentMethod"

const columns: { id: ColId; label: string; align: "left" | "right" }[] = [
  { id: "projectName", label: "Project", align: "left" },
  { id: "paidOn", label: "Paid On", align: "left" },
  { id: "amount", label: "Amount", align: "right" },
  { id: "paymentMethod", label: "Payment Method", align: "left" },
]

function sortVat(rows: VatTaxRow[], sort: SortState<ColId>): VatTaxRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case "projectName":
        cmp = a.projectName.localeCompare(b.projectName, "en", { sensitivity: "base" })
        break
      case "paidOn":
        cmp = a.paidOn.localeCompare(b.paidOn)
        break
      case "amount":
        cmp = a.amount - b.amount
        break
      case "paymentMethod":
        cmp = a.paymentMethod.localeCompare(b.paymentMethod)
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })
  return sorted
}

export function VatTaxTable({
  payments,
  projects,
  bankAccounts,
  paymentMethods,
  error,
}: {
  payments: VatTaxRow[]
  projects: ProjectOption[]
  bankAccounts: BankAccountChoice[]
  paymentMethods: string[]
  error: string | null
}) {
  const [sort, setSort] = useState<SortState<ColId>>({
    key: "paidOn",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formSession, setFormSession] = useState(0)

  const sorted = useMemo(() => sortVat(payments, sort), [payments, sort])
  const pageResult = useMemo(() => paginateRows(sorted, page), [sorted, page])
  const pages = paginationItems(pageResult.currentPage, pageResult.pageCount)

  function openForm() {
    setFormSession((s) => s + 1)
    setFormOpen(true)
  }

  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            VAT / Tax Payments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Total: {formatMoney(totalAmount)}
          </p>
        </div>
        <Button type="button" onClick={openForm}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add Payment
        </Button>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {columns.map((col) => {
                const active = sort.key === col.id
                return (
                  <TableHead
                    key={col.id}
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={cn(col.align === "right" && "text-right")}
                  >
                    <div
                      className={cn(
                        "flex",
                        col.align === "right" && "justify-end",
                      )}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(
                          col.align === "right" ? "-mr-2" : "-ml-2",
                        )}
                        onClick={() => {
                          setSort(toggleSort(sort, col.id))
                          setPage(1)
                        }}
                      >
                        {col.label}
                      </Button>
                    </div>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  role="alert"
                  className="py-8 text-center whitespace-normal text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : pageResult.rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="py-8 text-center whitespace-normal text-muted-foreground"
                >
                  No VAT / Tax Payments Yet.
                </TableCell>
              </TableRow>
            ) : (
              pageResult.rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.projectName || "—"}
                  </TableCell>
                  <TableCell>
                    {p.paidOn ? formatIsoDate(p.paidOn) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(p.amount)}
                  </TableCell>
                  <TableCell>{p.paymentMethod || "—"}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {rangeLabel(
              pageResult.rangeStart,
              pageResult.rangeEnd,
              pageResult.total,
              "payment",
              "payments",
            )}
          </p>
          <Pagination
            aria-label="VAT tax pagination"
            className="mx-0 w-auto justify-start sm:justify-end"
          >
            <PaginationContent className="flex-wrap">
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pageResult.currentPage <= 1}
                  aria-label="Go to previous page"
                  onClick={() => setPage(pageResult.currentPage - 1)}
                >
                  <ChevronLeft aria-hidden="true" data-icon="inline-start" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
              </PaginationItem>
              {pages.map((item, index) =>
                item === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <Button
                      type="button"
                      variant={
                        item === pageResult.currentPage ? "outline" : "ghost"
                      }
                      size="icon"
                      aria-label={`Page ${item}`}
                      aria-current={
                        item === pageResult.currentPage ? "page" : undefined
                      }
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </Button>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pageResult.currentPage >= pageResult.pageCount}
                  aria-label="Go to next page"
                  onClick={() => setPage(pageResult.currentPage + 1)}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight aria-hidden="true" data-icon="inline-end" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      <VatTaxFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        projects={projects}
        bankAccounts={bankAccounts}
        paymentMethods={paymentMethods}
      />
    </div>
  )
}
