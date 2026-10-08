"use client"

import { MoreHorizontal, Pencil, Trash2, Wallet } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import { deleteVendorInvoice } from "@/app/(app)/purchase-orders/[id]/actions"
import { RecordVendorPaymentDialog } from "@/app/(app)/purchase-orders/[id]/record-vendor-payment-dialog"
import { VendorInvoiceFormDialog } from "@/app/(app)/purchase-orders/[id]/vendor-invoice-form-dialog"
import { VendorPaymentsDialog } from "@/app/(app)/purchase-orders/[id]/vendor-payments-dialog"
import { CustomizeColumns, DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { PaymentStatusBadge } from "@/components/payment-status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BankAccountChoice } from "@/lib/bank-account"
import { formatIsoDate, formatMoney } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { useColumnVisibility } from "@/lib/use-column-visibility"
import { vendorInvoiceColumnStore } from "@/lib/vendor-invoice-column-store"
import {
  sortVendorInvoices,
  vendorInvoiceColumns,
  type PurchaseOrderDetail,
  type VendorInvoiceColumnId,
  type VendorInvoiceRow,
} from "@/lib/vendor-invoice-summary"

export function VendorInvoicesPanel({
  purchaseOrder,
  invoices,
  paymentMethods,
  expenseCategories,
  bankAccounts,
  error,
}: {
  purchaseOrder: PurchaseOrderDetail | null
  invoices: VendorInvoiceRow[]
  paymentMethods: string[]
  expenseCategories: string[]
  bankAccounts: BankAccountChoice[]
  error: string | null
}) {
  const visibility = useColumnVisibility(vendorInvoiceColumnStore)
  const [sort, setSort] = useState<SortState<VendorInvoiceColumnId>>({
    key: "issuedOn",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formInvoice, setFormInvoice] = useState<VendorInvoiceRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [recordOpen, setRecordOpen] = useState(false)
  const [recordSession, setRecordSession] = useState(0)
  const [paymentsOpen, setPaymentsOpen] = useState(false)
  const [paymentsInvoiceId, setPaymentsInvoiceId] = useState<string | null>(
    null,
  )
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<VendorInvoiceRow | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(
    () => sortVendorInvoices(invoices, sort),
    [invoices, sort],
  )
  const pageResult = paginateRows(sorted, page)
  const paymentsInvoice =
    invoices.find((invoice) => invoice.id === paymentsInvoiceId) ?? null

  function openForm(invoice: VendorInvoiceRow | null) {
    setFormInvoice(invoice)
    setFormSession((current) => current + 1)
    setFormOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteVendorInvoice(id)
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-medium tracking-tight">Vendor Payments</h1>
          <p className="text-sm text-muted-foreground">
            Pay the vendor against this purchase order.
          </p>
          {purchaseOrder ? (
            <>
              <p className="text-sm text-muted-foreground">
                {purchaseOrder.vendorName || "Vendor"} ·{" "}
                {purchaseOrder.projectName || "Project"}
                {purchaseOrder.workType ? ` · ${purchaseOrder.workType}` : ""} ·{" "}
                {purchaseOrder.issuedOn
                  ? formatIsoDate(purchaseOrder.issuedOn)
                  : "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                Purchase Order Value {formatMoney(purchaseOrder.totalValue)} ·
                Paid {formatMoney(purchaseOrder.totalPaid)} · Pending{" "}
                {formatMoney(purchaseOrder.totalPending)}
              </p>
            </>
          ) : null}
          <p className="text-sm text-muted-foreground">
            <Link
              href="/purchase-orders"
              className="font-medium text-foreground underline underline-offset-4"
            >
              All Purchase Orders
            </Link>
          </p>
        </div>
      </div>

      <DataList
        columns={vendorInvoiceColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(invoice) => invoice.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
          setPage(1)
        }}
        visibility={visibility}
        error={error}
        emptyMessage="No Vendor Payments For This Purchase Order."
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
        pagingLabel="Vendor Payments pagination"
        toolbar={
          <>
            <CustomizeColumns
              columns={vendorInvoiceColumns}
              visibility={visibility}
              onVisibilityChange={(id, checked) => {
                if (id === "issuedOn") {
                  return
                }

                vendorInvoiceColumnStore.write({ ...visibility, [id]: checked })
              }}
            />
            <Button
              type="button"
              disabled={!purchaseOrder}
              onClick={() => {
                setRecordSession((current) => current + 1)
                setRecordOpen(true)
              }}
            >
              <Wallet aria-hidden="true" data-icon="inline-start" />
              Record Payment
            </Button>
          </>
        }
        renderCell={(invoice, columnId) => (
          <InvoiceCell invoice={invoice} columnId={columnId} />
        )}
        renderActions={(invoice) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for payment issued ${invoice.issuedOn || "on an unknown date"}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => openForm(invoice)}>
                <Pencil aria-hidden="true" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setPaymentsInvoiceId(invoice.id)
                  setPaymentsOpen(true)
                }}
              >
                <Wallet aria-hidden="true" />
                Payments
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setDeleteError(null)
                  setPendingDelete(invoice)
                  setDeleteOpen(true)
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      {purchaseOrder ? (
        <>
          <VendorInvoiceFormDialog
            key={formSession}
            open={formOpen}
            onOpenChange={setFormOpen}
            purchaseOrderId={purchaseOrder.id}
            invoice={formInvoice}
          />
          <RecordVendorPaymentDialog
            key={recordSession}
            open={recordOpen}
            onOpenChange={setRecordOpen}
            purchaseOrder={purchaseOrder}
            paymentMethods={paymentMethods}
            bankAccounts={bankAccounts}
          />
        </>
      ) : null}

      <VendorPaymentsDialog
        open={paymentsOpen}
        onOpenChange={setPaymentsOpen}
        invoice={paymentsInvoice}
        paymentMethods={paymentMethods}
        expenseCategories={expenseCategories}
        bankAccounts={bankAccounts}
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
        title="Delete Vendor Payment"
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function InvoiceCell({
  invoice,
  columnId,
}: {
  invoice: VendorInvoiceRow
  columnId: VendorInvoiceColumnId
}) {
  switch (columnId) {
    case "issuedOn":
      return invoice.issuedOn ? (
        <span>{formatIsoDate(invoice.issuedOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "description":
      return invoice.description ? (
        <span>{invoice.description}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "amount":
    case "paid":
    case "balance":
      return (
        <span className="tabular-nums">{formatMoney(invoice[columnId])}</span>
      )
    case "status":
      return <PaymentStatusBadge status={invoice.status} />
  }
}
