"use client"

import { MoreHorizontal, Pencil, Plus, Trash2, Wallet } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import { deleteClientInvoice } from "@/app/(app)/accounts/invoices/actions"
import { ClientInvoiceFormDialog } from "@/app/(app)/accounts/invoices/client-invoice-form-dialog"
import { ClientPaymentsDialog } from "@/app/(app)/accounts/invoices/client-payments-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { clientInvoiceColumnStore } from "@/lib/client-invoice-column-store"
import {
  clientInvoiceColumns,
  sortClientInvoices,
  type ClientInvoiceColumnId,
  type ClientInvoiceRow,
  type InvoiceProjectOption,
} from "@/lib/client-invoice-summary"
import type { BankAccountChoice } from "@/lib/bank-account"
import type { InvoiceProjectFilter } from "@/lib/client-invoices"
import { formatIsoDate, formatMoney } from "@/lib/format"
import { isClientInvoicePaid, sumAmounts } from "@/lib/payment-status"
import { cn } from "@/lib/utils"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { useColumnVisibility } from "@/lib/use-column-visibility"

const pillClassName = "h-7 gap-1.5 rounded-full px-2.5 text-sm font-medium"

export function ClientInvoicesTable({
  invoices,
  projects,
  paymentMethods,
  bankAccounts,
  projectFilter,
  error,
}: {
  invoices: ClientInvoiceRow[]
  projects: InvoiceProjectOption[]
  paymentMethods: string[]
  bankAccounts: BankAccountChoice[]
  projectFilter: InvoiceProjectFilter | null
  error: string | null
}) {
  const visibility = useColumnVisibility(clientInvoiceColumnStore)
  const [sort, setSort] = useState<SortState<ClientInvoiceColumnId>>({
    key: "issuedOn",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formInvoice, setFormInvoice] = useState<ClientInvoiceRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [paymentsOpen, setPaymentsOpen] = useState(false)
  const [paymentsInvoiceId, setPaymentsInvoiceId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ClientInvoiceRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(
    () => sortClientInvoices(invoices, sort),
    [invoices, sort],
  )
  const pageResult = paginateRows(sorted, page)
  const paymentsInvoice =
    invoices.find((invoice) => invoice.id === paymentsInvoiceId) ?? null

  function openForm(invoice: ClientInvoiceRow | null) {
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
        const result = await deleteClientInvoice(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this invoice.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-2xl font-medium tracking-tight">Client Invoices</h1>
        {projectFilter ? (
          <p className="text-sm text-muted-foreground">
            For {projectFilter.name || "this project"}.{" "}
            <Link
              href="/accounts/invoices"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Show All
            </Link>
          </p>
        ) : null}
      </div>
      <DataList
        columns={clientInvoiceColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(invoice) => invoice.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
          setPage(1)
        }}
        visibility={visibility}
        error={error}
        emptyMessage={
          projectFilter
            ? "No Client Invoices For This Project."
            : "No Client Invoices Yet."
        }
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
        pagingLabel="Client Invoices pagination"
        toolbar={
          <Button type="button" onClick={() => openForm(null)}>
            <Plus aria-hidden="true" data-icon="inline-start" />
            Add Client Invoice
          </Button>
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
                  aria-label={`Actions for ${invoice.projectName || "client invoice"}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
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
      <ClientInvoiceFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        invoice={formInvoice}
        projects={projects}
        defaultProjectId={projectFilter?.id ?? null}
      />
      <ClientPaymentsDialog
        open={paymentsOpen}
        onOpenChange={setPaymentsOpen}
        invoice={paymentsInvoice}
        paymentMethods={paymentMethods}
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
        title="Delete Client Invoice"
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
  invoice: ClientInvoiceRow
  columnId: ClientInvoiceColumnId
}) {
  switch (columnId) {
    case "issuedOn":
      return invoice.issuedOn ? (
        <span>{formatIsoDate(invoice.issuedOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "projectName":
      return invoice.projectName ? (
        <span className="font-medium">{invoice.projectName}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "clientName":
      return invoice.clientName ? (
        <Badge variant="outline" className={cn(pillClassName, "bg-card")}>
          {invoice.clientName}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "amount":
      return (
        <span className="flex flex-col items-end gap-0.5">
          <span className="tabular-nums">{formatMoney(invoice.amount)}</span>
          {invoice.taxAmount > 0 ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              Net {formatMoney(sumAmounts([invoice.amount, -invoice.taxAmount]))}{" "}
              · VAT/Tax {formatMoney(invoice.taxAmount)}
            </span>
          ) : null}
        </span>
      )
    case "paid":
      return isClientInvoicePaid(invoice.status) ? (
        <span className="tabular-nums">{formatMoney(invoice.paid)}</span>
      ) : (
        <StatusBadge status="pending" />
      )
    case "status":
      return <StatusBadge status={invoice.status} />
  }
}
