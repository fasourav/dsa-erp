"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useCan } from "@/components/access-provider"

import { MoreHorizontal, Pencil, Trash2, Wallet } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition, type ReactNode } from "react"

import { deleteVendorInvoice } from "@/app/(app)/purchase-orders/[id]/actions"
import { RecordVendorPaymentDialog } from "@/app/(app)/purchase-orders/[id]/record-vendor-payment-dialog"
import { VendorInvoiceFormDialog } from "@/app/(app)/purchase-orders/[id]/vendor-invoice-form-dialog"
import { VendorPaymentsDialog } from "@/app/(app)/purchase-orders/[id]/vendor-payments-dialog"
import { DataList } from "@/components/data-list"
import { RecordAttachments } from "@/components/record-attachments"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader, SectionHeader } from "@/components/page-header"
import { paymentBalanceStatus, StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BankAccountChoice } from "@/lib/bank-account"
import { formatIsoDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
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
  const canAdd = useCan("vendor_payments", "add")
  const canEdit = useCan("vendor_payments", "edit")
  const canDelete = useCan("vendor_payments", "delete")

  const [sort, setSort] = useState<SortState<VendorInvoiceColumnId>>({
    key: "issuedOn",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
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
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = paginateRows(filtered, page)
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

  const paidShare =
    purchaseOrder && purchaseOrder.totalValue > 0
      ? Math.min(100, (purchaseOrder.totalPaid / purchaseOrder.totalValue) * 100)
      : 0
  const paymentStatus = purchaseOrder
    ? paymentBalanceStatus(purchaseOrder.totalPaid, purchaseOrder.totalPending)
    : null
  const detailTitle = purchaseOrder
    ? purchaseOrder.projectId
      ? purchaseOrder.projectName || "Project"
      : "Operational"
    : "Vendor Payments"

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <PageHeader
        className="mb-0 md:mb-2"
        eyebrow={purchaseOrder ? purchaseOrder.vendorName || "Vendor" : undefined}
        title={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            {detailTitle}
            {paymentStatus ? <StatusBadge status={paymentStatus} /> : null}
          </span>
        }
        actions={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/purchase-orders" />}
            >
              All Purchase Orders
            </Button>
            {canAdd ? (
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
            ) : null}
          </>
        }
      />
      {purchaseOrder ? (
        <RecordAttachments parentType="purchase_order" parentId={purchaseOrder.id} />
      ) : null}

      {purchaseOrder ? (
        <>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 md:gap-4">
            <Kpi label="Purchase Order Value" value={purchaseOrder.totalValue} />
            <Kpi
              label="Paid"
              value={purchaseOrder.totalPaid}
              className={
                purchaseOrder.totalPaid > 0 ? "text-success" : "text-muted-foreground"
              }
            />
            <Kpi
              label="Pending"
              value={purchaseOrder.totalPending}
              className={
                purchaseOrder.totalPending > 0
                  ? "text-destructive"
                  : "text-muted-foreground"
              }
            />
          </div>
          <Card className="gap-3 px-4 py-4 md:px-6 md:py-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-label text-muted-foreground">Paid Share</p>
              <p className="text-ui font-semibold tabular-nums">{Math.round(paidShare)}%</p>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-fill-strong"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(paidShare)}
              aria-label="Paid share of purchase order value"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${paidShare}%` }}
              />
            </div>
          </Card>
          <Card className="gap-0 px-0 py-1 md:py-2">
            <dl>
              <DetailRow
                label="Project"
                value={
                  purchaseOrder.projectId
                    ? purchaseOrder.projectName || "Project"
                    : "Operational"
                }
              />
              <DetailRow
                label="Work Type"
                value={
                  purchaseOrder.workType ? (
                    <Badge variant="outline">{purchaseOrder.workType}</Badge>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow
                label="Issued On"
                value={
                  purchaseOrder.issuedOn
                    ? formatIsoDate(purchaseOrder.issuedOn)
                    : "—"
                }
              />
            </dl>
          </Card>
          <SectionHeader title="Vendor Payments" className="pt-1 md:mt-1 md:mb-0" />
        </>
      ) : null}

      <ListSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        placeholder="Search invoices"
      />
      <DataList
        columns={vendorInvoiceColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(invoice) => invoice.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
          setPage(1)
        }}
        visibility={{}}
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
        mobileItem={(invoice) => ({
          title: invoice.description || "Payment",
          subtitle: invoice.issuedOn ? formatIsoDate(invoice.issuedOn) : "—",
          value: <Money value={invoice.amount} />,
          meta: <StatusBadge status={invoice.status} />,
        })}
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
              {canEdit ? (<DropdownMenuItem onClick={() => openForm(invoice)}>
                <Pencil aria-hidden="true" />
                Edit
              </DropdownMenuItem>) : null}
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
              {canDelete ? (<DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setDeleteError(null)
                  setPendingDelete(invoice)
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
        partyName={purchaseOrder?.vendorName}
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
        itemName={pendingDelete?.description}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function Kpi({
  label,
  value,
  className,
}: {
  label: string
  value: number
  className?: string
}) {
  return (
    <Card className="min-w-0 gap-1 px-4 py-4 md:px-5.5 md:py-5">
      <p className="text-label text-muted-foreground">{label}</p>
      <p className={cn("text-kpi", className)}>
        <Money value={value} size="kpi" />
      </p>
    </Card>
  )
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 first:border-t-0 md:px-6">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="text-right text-ui font-semibold">{value}</dd>
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
        <span className="text-ui font-semibold">{invoice.description}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "amount":
      return <Money value={invoice.amount} />
    case "paid":
      return (
        <Money
          value={invoice.paid}
          className={invoice.paid > 0 ? "text-success" : "text-muted-foreground"}
        />
      )
    case "balance":
      return (
        <Money
          value={invoice.balance}
          className={invoice.balance > 0 ? "text-destructive" : "text-muted-foreground"}
        />
      )
    case "status":
      return <StatusBadge status={invoice.status} />
  }
}
