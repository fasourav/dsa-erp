"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useCan } from "@/components/access-provider"

import { MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import { deleteVatTaxPayment } from "@/app/(app)/accounts/vat-tax/actions"
import { VatTaxFormDialog } from "@/app/(app)/accounts/vat-tax/vat-tax-form-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BankAccountChoice } from "@/lib/bank-account"
import { formatIsoDate, formatMoney } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import type { ProjectOption, VatTaxRow } from "@/lib/vat-tax"

type ColId = "projectName" | "paidOn" | "amount" | "paymentMethod"

const columns: readonly ListColumn<ColId>[] = [
  { id: "projectName", label: "Project", align: "left", locked: true },
  { id: "paidOn", label: "Paid On", align: "left", locked: true },
  { id: "amount", label: "Amount", align: "right", locked: true },
  { id: "paymentMethod", label: "Payment Method", align: "left", locked: true },
]

function sortVat(rows: VatTaxRow[], sort: SortState<ColId>): VatTaxRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case "projectName":
        cmp = a.projectName.localeCompare(b.projectName, "en", {
          sensitivity: "base",
        })
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
  const canAdd = useCan("vat_tax", "add")
  const canDelete = useCan("vat_tax", "delete")

  const [sort, setSort] = useState<SortState<ColId>>({
    key: "paidOn",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<VatTaxRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(() => sortVat(payments, sort), [payments, sort])
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = useMemo(() => paginateRows(filtered, page), [filtered, page])

  function openForm() {
    setFormSession((s) => s + 1)
    setFormOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteVatTaxPayment(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this payment.")
      }
    })
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
        {canAdd ? (<Button type="button" onClick={openForm}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add Payment
        </Button>) : null}
      </div>

      <ListSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        placeholder="Search payments"
      />
      <DataList
        columns={columns}
        rows={error ? [] : pageResult.rows}
        rowKey={(payment) => payment.id}
        sort={sort}
        onSort={(key) => {
          setSort(toggleSort(sort, key))
          setPage(1)
        }}
        visibility={{}}
        error={error}
        emptyMessage="No VAT / Tax Payments Yet."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "payment",
          "payments",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="VAT tax pagination"
        renderCell={(payment, columnId) => (
          <Cell payment={payment} columnId={columnId} />
        )}
        renderActions={(payment) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${payment.projectName || "VAT tax payment"}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              {canDelete ? (<DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setDeleteError(null)
                  setPendingDelete(payment)
                  setDeleteOpen(true)
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </DropdownMenuItem>) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <VatTaxFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        projects={projects}
        bankAccounts={bankAccounts}
        paymentMethods={paymentMethods}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete VAT / Tax Payment"
        itemName={pendingDelete?.projectName}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function Cell({
  payment,
  columnId,
}: {
  payment: VatTaxRow
  columnId: ColId
}) {
  switch (columnId) {
    case "projectName":
      return (
        <span className="font-medium">{payment.projectName || "—"}</span>
      )
    case "paidOn":
      return payment.paidOn ? (
        <span>{formatIsoDate(payment.paidOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "amount":
      return <span className="tabular-nums">{formatMoney(payment.amount)}</span>
    case "paymentMethod":
      return payment.paymentMethod ? (
        <span>{payment.paymentMethod}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}
