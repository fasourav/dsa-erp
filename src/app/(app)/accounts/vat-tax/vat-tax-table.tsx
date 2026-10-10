"use client"

import { Plus } from "lucide-react"
import { useMemo, useState } from "react"

import { VatTaxFormDialog } from "@/app/(app)/accounts/vat-tax/vat-tax-form-dialog"
import { DataList } from "@/components/data-list"
import { Button } from "@/components/ui/button"
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

type ColId = "projectName" | "paidOn" | "amount" | "kind" | "paymentMethod"

const columns: readonly ListColumn<ColId>[] = [
  { id: "projectName", label: "Project", align: "left", locked: true },
  { id: "paidOn", label: "Paid On", align: "left", locked: true },
  { id: "amount", label: "Amount", align: "right", locked: true },
  { id: "kind", label: "Kind", align: "left", locked: true },
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
      case "kind":
        cmp = (a.collectedOnInvoice ? "Collected" : "Paid").localeCompare(
          b.collectedOnInvoice ? "Collected" : "Paid",
          "en",
          { sensitivity: "base" },
        )
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

  function openForm() {
    setFormSession((s) => s + 1)
    setFormOpen(true)
  }

  const paidAmount = payments.reduce(
    (sum, payment) => (payment.collectedOnInvoice ? sum : sum + payment.amount),
    0,
  )
  const collectedAmount = payments.reduce(
    (sum, payment) => (payment.collectedOnInvoice ? sum + payment.amount : sum),
    0,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">
            VAT / Tax Payments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tax Paid: {formatMoney(paidAmount)} · Collected On Invoices:{" "}
            {formatMoney(collectedAmount)}. Collected tax is the VAT/Tax split
            out of a client invoice. It stays inside that invoice and does not
            leave the bank.
          </p>
        </div>
        <Button type="button" onClick={openForm}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add Payment
        </Button>
      </div>

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
      />

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
    case "kind":
      return <span>{payment.collectedOnInvoice ? "Collected" : "Paid"}</span>
    case "paymentMethod":
      return payment.paymentMethod ? (
        <span>{payment.paymentMethod}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}
