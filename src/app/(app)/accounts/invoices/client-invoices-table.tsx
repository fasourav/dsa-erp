"use client"

import { ListExport } from "@/components/list-export"
import { ListSearch } from "@/components/list-search"
import { useCan } from "@/components/access-provider"

import { MoreHorizontal, Pencil, Plus, Trash2, Wallet } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"

import { exportClientInvoicesGrid } from "@/app/(app)/accounts/export-actions"
import { deleteClientInvoice } from "@/app/(app)/accounts/invoices/actions"
import { ClientInvoiceFormDialog } from "@/app/(app)/accounts/invoices/client-invoice-form-dialog"
import { ClientPaymentsDialog } from "@/app/(app)/accounts/invoices/client-payments-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
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
  defaultClientInvoiceSort,
  type ClientInvoiceColumnId,
  type ClientInvoiceRow,
  type InvoiceProjectOption,
} from "@/lib/client-invoice-summary"
import type { BankAccountChoice } from "@/lib/bank-account"
import type {
  InvoiceProjectFilter,
  InvoiceStatusFilter,
} from "@/lib/client-invoices"
import { formatIsoDate } from "@/lib/format"
import {
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { LIST_PAGE_SIZE, sortQueryParams } from "@/lib/page-query"
import { useColumnVisibility } from "@/lib/use-column-visibility"
import { useUrlSearch } from "@/lib/use-url-search"

export function ClientInvoicesTable({
  invoices,
  projects,
  paymentMethods,
  bankAccounts,
  projectFilter,
  total,
  page,
  error,
  initialQuery = "",
  statusFilter = "all",
  sort = defaultClientInvoiceSort,
}: {
  invoices: ClientInvoiceRow[]
  projects: InvoiceProjectOption[]
  paymentMethods: string[]
  bankAccounts: BankAccountChoice[]
  projectFilter: InvoiceProjectFilter | null
  total: number
  page: number
  pageCount?: number
  error: string | null
  initialQuery?: string
  statusFilter?: InvoiceStatusFilter
  sort?: SortState<ClientInvoiceColumnId>
}) {
  const canAdd = useCan("client_invoices", "add")
  const canEdit = useCan("client_invoices", "edit")
  const canDelete = useCan("client_invoices", "delete")

  const visibility = useColumnVisibility(clientInvoiceColumnStore)
  const { query, setQuery, setParams } = useUrlSearch(initialQuery)
  const [formOpen, setFormOpen] = useState(false)
  const [formInvoice, setFormInvoice] = useState<ClientInvoiceRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [paymentsOpen, setPaymentsOpen] = useState(false)
  const [paymentsInvoiceId, setPaymentsInvoiceId] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ClientInvoiceRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const filterOptions = [
    { value: "all", label: "All Statuses" },
    { value: "unpaid", label: "Unpaid" },
    { value: "partial", label: "Partially Paid" },
    { value: "paid", label: "Paid" },
  ]

  const effectiveTotal = error ? 0 : total
  const rangeStart =
    effectiveTotal === 0 || invoices.length === 0
      ? 0
      : (page - 1) * LIST_PAGE_SIZE + 1
  const rangeEnd =
    effectiveTotal === 0 || invoices.length === 0
      ? 0
      : rangeStart + invoices.length - 1

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
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Client Invoices"
        className="mb-0 md:mb-2"
        description={
          projectFilter ? (
            <>
              For {projectFilter.name || "this project"}.{" "}
              <Link
                href="/accounts/invoices"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Show All
              </Link>
            </>
          ) : undefined
        }
        actions={
          <>
            <ListExport
              loadGrid={() =>
                exportClientInvoicesGrid({
                  projectId: projectFilter?.id ?? null,
                  q: query,
                  status: statusFilter,
                  sortKey: sort.key,
                  sortDir: sort.direction,
                })
              }
            />
            {canAdd ? (
              <Button type="button" onClick={() => openForm(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add Client Invoice
              </Button>
            ) : null}
          </>
        }
      />
      <ListSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Search invoices"
        filterLabel="Status"
        filter={statusFilter}
        onFilterChange={(next) =>
          setParams({ status: next === "all" ? null : next })
        }
        options={filterOptions}
      />
      <DataList
        columns={clientInvoiceColumns}
        rows={error ? [] : invoices}
        rowKey={(invoice) => invoice.id}
        sort={sort}
        onSort={(key) => {
          const next = toggleSort(sort, key)
          setParams(sortQueryParams(next, defaultClientInvoiceSort))
        }}
        visibility={visibility}
        error={error}
        emptyMessage={
          statusFilter !== "all" || Boolean(query.trim())
            ? "No Matching Client Invoices."
            : projectFilter
              ? "No Client Invoices For This Project."
              : "No Client Invoices Yet."
        }
        rangeText={rangeLabel(
          rangeStart,
          rangeEnd,
          effectiveTotal,
          "invoice",
          "invoices",
        )}
        hidePagination
        mobileItem={(invoice) => ({
          title: projectTitle(invoice.projectName),
          value: <StatusBadge status={invoice.status} />,
          subtitle: [
            invoice.issuedOn ? formatIsoDate(invoice.issuedOn) : "",
            invoice.clientName,
          ]
            .filter(Boolean)
            .join(" · "),
          meta: <Money value={invoice.amount} />,
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
                  aria-label={`Actions for ${projectTitle(invoice.projectName)}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {canEdit ? (
                <DropdownMenuItem onClick={() => openForm(invoice)}>
                  <Pencil aria-hidden="true" />
                  Edit
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                onClick={() => {
                  setPaymentsInvoiceId(invoice.id)
                  setPaymentsOpen(true)
                }}
              >
                <Wallet aria-hidden="true" />
                Payments
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`/documents/invoices/${invoice.id}`} />}>
                Print / Download
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {canDelete ? (
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
              ) : null}
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
        itemName={pendingDelete?.projectName}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function projectTitle(name: string) {
  const trimmed = name.trim()
  return trimmed || "Untitled Project"
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
        <span className="text-muted-foreground">{formatIsoDate(invoice.issuedOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "projectName":
      return (
        <span className="text-ui font-semibold">{projectTitle(invoice.projectName)}</span>
      )
    case "clientName":
      return invoice.clientName ? (
        <span>{invoice.clientName}</span>
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
    case "status":
      return <StatusBadge status={invoice.status} />
  }
}
