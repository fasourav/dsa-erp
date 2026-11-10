"use client"

import { ListExport } from "@/components/list-export"
import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useCan, useSeesMoney } from "@/components/access-provider"

import { FileText, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import { deleteVendor } from "@/app/(app)/vendors/actions"
import { VendorContactDialog } from "@/app/(app)/vendors/vendor-contact-dialog"
import { VendorFormDialog } from "@/app/(app)/vendors/vendor-form-dialog"
import { MailtoLink, TelLink } from "@/components/contact-links"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { formatPhoneDisplay } from "@/lib/phone"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  dataColumns,
  paginateVendors,
  sortVendors,
  vendorRangeLabel,
  type ColumnId,
  type SortState,
  type VendorSummary,
} from "@/lib/vendor-summary"
import { useListUrlState } from "@/lib/use-list-url-state"
import { cn } from "@/lib/utils"

const vendorSortKeys = dataColumns.map((column) => column.id)
const defaultVendorSort: SortState = { key: "displayName", direction: "asc" }
const vendorTypeValues = ["all", "private", "company"] as const
const filterOptions = [
  { value: "all", label: "All Types" },
  { value: "private", label: "Private" },
  { value: "company", label: "Company" },
]

export function VendorsTable({
  vendors,
  categories,
  error,
}: {
  vendors: VendorSummary[]
  categories: string[]
  error: string | null
  initialQuery?: string
}) {
  const canAdd = useCan("vendors", "add")
  const seesMoney = useSeesMoney()

  const {
    query,
    setQuery,
    facet: listFilter,
    setFacet: setListFilter,
    sort,
    onSort,
    page,
    setPage,
    clearFilters,
    hasActiveFilters,
  } = useListUrlState<ColumnId>({
    sortKeys: vendorSortKeys,
    defaultSort: defaultVendorSort,
    facet: { key: "type", options: vendorTypeValues },
  })
  const [formOpen, setFormOpen] = useState(false)
  const [formVendor, setFormVendor] = useState<VendorSummary | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactVendor, setContactVendor] = useState<VendorSummary | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<VendorSummary | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(() => sortVendors(vendors, sort), [vendors, sort])
  const filtered = useMemo(
    () => filterRows(sorted, query, rowText, listFilter, (vendor) => vendor.kind ?? ""),
    [listFilter, query, sorted],
  )
  const pageResult = useMemo(
    () => paginateVendors(filtered, page),
    [filtered, page],
  )

  function openForm(vendor: VendorSummary | null) {
    setFormVendor(vendor)
    setFormSession((current) => current + 1)
    setFormOpen(true)
  }

  function openContact(vendor: VendorSummary) {
    setContactVendor(vendor)
    setContactOpen(true)
  }

  function askDelete(vendor: VendorSummary) {
    setDeleteError(null)
    setPendingDelete(vendor)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteVendor(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this vendor.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Vendors"
        className="mb-0 md:mb-2"
        actions={
          <>
            <ListExport
              grid={{
                filename: "vendors",
                title: "Vendors",
                columns: [
                  { header: "Vendor Name", kind: "text" },
                  { header: "Category", kind: "text" },
                  { header: "Contact", kind: "text" },
                  { header: "Total Project Value", kind: "money" },
                  { header: "Total Paid", kind: "money" },
                  { header: "Total Due", kind: "money" },
                ],
                rows: filtered.map((vendor) => [
                  vendor.displayName,
                  vendor.vendorField || "—",
                  [formatPhoneDisplay(vendor.phone ?? ""), vendor.email].map((value) => value?.trim()).filter(Boolean).join(" · ") || "—",
                  seesMoney ? vendor.totalProjectValue : "Hidden",
                  seesMoney ? vendor.totalPaid : "Hidden",
                  seesMoney ? vendor.totalDue : "Hidden",
                ]),
              }}
            />
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/purchase-orders" />}
            >
              Purchase Orders
            </Button>
            {canAdd ? (
              <Button type="button" onClick={() => openForm(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add New Vendor
              </Button>
            ) : null}
          </>
        }
      />

      <ListSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Search vendors"
        filterLabel="Type"
        filter={listFilter}
        onFilterChange={setListFilter}
        options={filterOptions}
      />
      <DataList
        columns={dataColumns.map((column) => ({ ...column, locked: true }))}
        rows={error ? [] : pageResult.rows}
        rowKey={(vendor) => vendor.id}
        sort={sort}
        onSort={onSort}
        visibility={{}}
        error={error}
        emptyMessage="No Vendors Yet."
        emptyState={
          vendors.length === 0 && !hasActiveFilters
            ? {
                kind: "none",
                action: canAdd ? (
                  <Button type="button" onClick={() => openForm(null)}>
                    <Plus aria-hidden="true" data-icon="inline-start" />
                    Add New Vendor
                  </Button>
                ) : undefined,
              }
            : { kind: "filtered", onClearFilters: clearFilters }
        }
        rangeText={vendorRangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Vendors pagination"
        mobileItem={(vendor) => ({
          title: (
            <Button
              type="button"
              variant="link"
              className={cn(
                "h-auto min-h-8 px-0 text-row font-semibold text-foreground",
                !vendor.displayName && "text-muted-foreground",
              )}
              aria-label={`Open contact card for ${vendor.displayName || "vendor"}`}
              onClick={() => openContact(vendor)}
            >
              {vendor.displayName || "—"}
            </Button>
          ),
          value: <Money value={vendor.totalProjectValue} />,
          subtitle: contactSubtitle(vendor),
          detail: vendorDetail(vendor),
        })}
        renderCell={(vendor, columnId) => (
          <CellValue
            vendor={vendor}
            columnId={columnId}
            onOpenContact={openContact}
          />
        )}
        renderActions={(vendor) => (
          <RowActions vendor={vendor} onEdit={openForm} onDelete={askDelete} />
        )}
      />

      <VendorFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        vendor={formVendor}
        categories={categories}
      />

      <VendorContactDialog
        vendor={contactVendor}
        open={contactOpen}
        onOpenChange={setContactOpen}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete Vendor"
        itemName={pendingDelete?.displayName}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function contactSubtitle(vendor: VendorSummary) {
  const phone = formatPhoneDisplay(vendor.phone ?? "")
  const email = vendor.email?.trim() ?? ""
  return [phone, email].filter(Boolean).join(" · ")
}

function vendorDetail(vendor: VendorSummary) {
  const category = vendor.vendorField?.trim() ?? ""
  return (
    <>
      {category ? (
        <>
          <span className="font-medium text-foreground">{category}</span>
          <span aria-hidden="true"> · </span>
        </>
      ) : null}
      <span>
        Paid{" "}
        <Money
          value={vendor.totalPaid}
          className={cn(
            "font-semibold",
            vendor.totalPaid > 0 ? "text-success" : "text-muted-foreground",
          )}
        />
      </span>
      <span aria-hidden="true"> · </span>
      <span>
        Due{" "}
        <Money
          value={vendor.totalDue}
          className={cn(
            "font-semibold",
            vendor.totalDue > 0 ? "text-destructive" : "text-muted-foreground",
          )}
        />
      </span>
    </>
  )
}

function CellValue({
  vendor,
  columnId,
  onOpenContact,
}: {
  vendor: VendorSummary
  columnId: ColumnId
  onOpenContact: (vendor: VendorSummary) => void
}) {
  switch (columnId) {
    case "displayName":
      return (
        <Button
          type="button"
          variant="link"
          className={cn(
            "h-auto min-h-8 px-0 text-ui font-semibold text-foreground",
            !vendor.displayName && "text-muted-foreground",
          )}
          aria-label={`Open contact card for ${vendor.displayName || "vendor"}`}
          onClick={() => onOpenContact(vendor)}
        >
          {vendor.displayName || "—"}
        </Button>
      )
    case "vendorField":
      return vendor.vendorField ? (
        <Badge variant="secondary">{vendor.vendorField}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "contact":
      return <ContactValue vendor={vendor} />
    case "totalProjectValue":
      return <Money value={vendor.totalProjectValue} />
    case "totalPaid":
      return (
        <Money
          value={vendor.totalPaid}
          className={vendor.totalPaid > 0 ? "text-success" : "text-muted-foreground"}
        />
      )
    case "totalDue":
      return (
        <Money
          value={vendor.totalDue}
          className={vendor.totalDue > 0 ? "text-destructive" : "text-muted-foreground"}
        />
      )
  }
}

function ContactValue({ vendor }: { vendor: VendorSummary }) {
  const phone = formatPhoneDisplay(vendor.phone ?? "")
  const email = vendor.email?.trim() ?? ""

  if (!phone && !email) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {phone ? <TelLink phone={phone} /> : null}
      {email ? (
        <MailtoLink
          email={email}
          className={cn(phone && "text-muted-foreground")}
        />
      ) : null}
    </div>
  )
}

function RowActions({
  vendor,
  onEdit,
  onDelete,
}: {
  vendor: VendorSummary
  onEdit: (vendor: VendorSummary) => void
  onDelete: (vendor: VendorSummary) => void
}) {
  const canViewVendors = useCan("vendors", "view")
  const canViewPayable = useCan("accounts_payable", "view")
  const canStatement = canViewVendors && canViewPayable
  const canEdit = useCan("vendors", "edit")
  const canDelete = useCan("vendors", "delete")
  const label = vendor.displayName || "vendor"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${label}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {canStatement ? (
          <DropdownMenuItem render={<Link href={`/vendors/${vendor.id}/statement`} />}>
            <FileText aria-hidden="true" />
            Statement
          </DropdownMenuItem>
        ) : null}
        {canEdit ? (
          <DropdownMenuItem onClick={() => onEdit(vendor)}>
            <Pencil aria-hidden="true" />
            Edit
          </DropdownMenuItem>
        ) : null}
        {canDelete ? <DropdownMenuSeparator /> : null}
        {canDelete ? (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(vendor)}>
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
