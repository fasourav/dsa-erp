"use client"

import { ListExport } from "@/components/list-export"
import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useCan } from "@/components/access-provider"

import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
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
import { cn } from "@/lib/utils"

export function VendorsTable({
  vendors,
  categories,
  error,
  initialQuery = "",
}: {
  vendors: VendorSummary[]
  categories: string[]
  error: string | null
  initialQuery?: string
}) {
  const canAdd = useCan("vendors", "add")

  const [sort, setSort] = useState<SortState>({
    key: "displayName",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState(initialQuery)
  const [listFilter, setListFilter] = useState("all")
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
  const filterOptions = [
    { value: "all", label: "All Types" },
    { value: "private", label: "Private" },
    { value: "company", label: "Company" },
  ]
  const filtered = useMemo(
    () => filterRows(sorted, query, rowText, listFilter, (vendor) => vendor.kind ?? ""),
    [listFilter, query, sorted],
  )
  const pageResult = useMemo(
    () => paginateVendors(filtered, page),
    [filtered, page],
  )

  function toggleSort(key: ColumnId) {
    setSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        }
      }

      return { key, direction: "asc" }
    })
    setPage(1)
  }

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
                  { header: "Contact", kind: "text" },
                  { header: "Total Project Value", kind: "money" },
                  { header: "Total Paid", kind: "money" },
                  { header: "Total Due", kind: "money" },
                ],
                rows: filtered.map((vendor) => [
                  vendor.displayName,
                  [formatPhoneDisplay(vendor.phone ?? ""), vendor.email].map((value) => value?.trim()).filter(Boolean).join(" · ") || "—",
                  vendor.totalProjectValue,
                  vendor.totalPaid,
                  vendor.totalDue,
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
        onQueryChange={(value) => {
          setQuery(value)
          setPage(1)
        }}
        placeholder="Search vendors"
        filterLabel="Type"
        filter={listFilter}
        onFilterChange={(value) => {
          setListFilter(value)
          setPage(1)
        }}
        options={filterOptions}
      />
      <DataList
        columns={dataColumns.map((column) => ({ ...column, locked: true }))}
        rows={error ? [] : pageResult.rows}
        rowKey={(vendor) => vendor.id}
        sort={sort}
        onSort={toggleSort}
        visibility={{}}
        error={error}
        emptyMessage="No Vendors Yet."
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
          title: vendor.displayName || "—",
          subtitle: contactSubtitle(vendor),
          meta: <Money value={vendor.totalProjectValue} />,
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
        <div className="flex min-w-0 flex-wrap items-center gap-2">
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
          {vendor.vendorField ? (
            <Badge variant="outline">{vendor.vendorField}</Badge>
          ) : null}
        </div>
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
      <DropdownMenuContent align="end" className="w-40">
        {canEdit ? (
          <DropdownMenuItem onClick={() => onEdit(vendor)}>
            <Pencil aria-hidden="true" />
            Edit
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
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
