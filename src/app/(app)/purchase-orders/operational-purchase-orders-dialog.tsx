"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useCan } from "@/components/access-provider"

import { ClipboardList, FileText, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useTransition } from "react"

import { deletePurchaseOrder } from "@/app/(app)/purchase-orders/actions"
import { PurchaseOrderFormDialog } from "@/app/(app)/purchase-orders/purchase-order-form-dialog"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { paymentBalanceStatus, StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
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
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import {
  formatPurchaseOrderDate,
  type PurchaseOrderRow,
  type VendorOption,
} from "@/lib/purchase-order-summary"

type OperationalColumnId =
  | "issuedOn"
  | "workType"
  | "vendorName"
  | "totalValue"
  | "totalPaid"
  | "totalPending"

const columns: readonly ListColumn<OperationalColumnId>[] = [
  { id: "issuedOn", label: "Date", align: "left", locked: true },
  { id: "workType", label: "Work Category", align: "left", locked: true },
  { id: "vendorName", label: "Vendor Name", align: "left", locked: true },
  {
    id: "totalValue",
    label: "Purchase Order Value",
    align: "right",
    locked: true,
  },
  { id: "totalPaid", label: "Total Paid", align: "right", locked: true },
  { id: "totalPending", label: "Pending Due", align: "right", locked: true },
]

export function OperationalPurchaseOrdersDialog({
  orders,
  vendors,
  workTypes,
}: {
  orders: PurchaseOrderRow[]
  vendors: VendorOption[]
  workTypes: string[]
}) {
  const canAdd = useCan("purchase_orders", "add")

  const operationalOrders = useMemo(
    () => orders.filter((order) => order.projectId == null),
    [orders],
  )
  const [open, setOpen] = useState(false)
  const [sort, setSort] = useState<SortState<OperationalColumnId>>({
    key: "issuedOn",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [formOrder, setFormOrder] = useState<PurchaseOrderRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PurchaseOrderRow | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(
    () => sortOperationalOrders(operationalOrders, sort),
    [operationalOrders, sort],
  )
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = paginateRows(filtered, page)

  function openForm(order: PurchaseOrderRow | null) {
    setFormOrder(order)
    setFormSession((current) => current + 1)
    setFormOpen(true)
  }

  function askDelete(order: PurchaseOrderRow) {
    setDeleteError(null)
    setPendingDelete(order)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deletePurchaseOrder(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this purchase order.")
      }
    })
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <ClipboardList aria-hidden="true" data-icon="inline-start" />
        Operational Purchase Orders
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden sm:max-w-5xl">
          <DialogHeader className="pr-8">
            <DialogTitle>Operational Purchase Orders</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex min-h-0 flex-col gap-4">
            <ListSearch
              query={query}
              onQueryChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder="Search purchase orders"
            />
            <DataList
              columns={columns}
              rows={pageResult.rows}
              rowKey={(order) => order.id}
              sort={sort}
              onSort={(key) => {
                setSort((current) => toggleSort(current, key))
                setPage(1)
              }}
              visibility={{}}
              error={null}
              emptyMessage="No Operational Purchase Orders Yet."
              rangeText={rangeLabel(
                pageResult.rangeStart,
                pageResult.rangeEnd,
                pageResult.total,
                "purchase order",
                "purchase orders",
              )}
              currentPage={pageResult.currentPage}
              pageCount={pageResult.pageCount}
              onPageChange={setPage}
              pagingLabel="Operational purchase orders pagination"
              mobileItem={(order) => ({
                title: order.vendorName || "—",
                subtitle: [
                  order.workType,
                  order.issuedOn ? formatPurchaseOrderDate(order.issuedOn) : "",
                ]
                  .filter(Boolean)
                  .join(" · "),
                value: <Money value={order.totalValue} />,
                meta: (
                  <StatusBadge
                    status={paymentBalanceStatus(
                      order.totalPaid,
                      order.totalPending,
                      order.totalValue,
                    )}
                  />
                ),
              })}
              toolbar={
                canAdd ? (
                  <Button type="button" onClick={() => openForm(null)}>
                    <Plus aria-hidden="true" data-icon="inline-start" />
                    Add Purchase Order
                  </Button>
                ) : null
              }
              renderCell={(order, columnId) => (
                <OperationalCell order={order} columnId={columnId} />
              )}
              renderActions={(order) => (
                <RowActions
                  order={order}
                  onEdit={openForm}
                  onDelete={askDelete}
                />
              )}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>

      <PurchaseOrderFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        purchaseOrder={formOrder}
        projects={[]}
        vendors={vendors}
        workTypes={workTypes}
        defaultProjectId={null}
        operational
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
        title="Delete Purchase Order"
        itemName={pendingDelete?.vendorName}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function OperationalCell({
  order,
  columnId,
}: {
  order: PurchaseOrderRow
  columnId: OperationalColumnId
}) {
  switch (columnId) {
    case "issuedOn":
      return order.issuedOn ? (
        <span className="text-muted-foreground">{formatPurchaseOrderDate(order.issuedOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "workType":
      return order.workType ? (
        <Badge variant="outline">{order.workType}</Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "vendorName":
      return (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <span
            className={
              order.vendorName
                ? "text-ui font-semibold"
                : "text-ui font-semibold text-muted-foreground"
            }
          >
            {order.vendorName || "—"}
          </span>
          <StatusBadge
            status={paymentBalanceStatus(
              order.totalPaid,
              order.totalPending,
              order.totalValue,
            )}
          />
        </div>
      )
    case "totalValue":
      return <Money value={order.totalValue} />
    case "totalPaid":
      return (
        <Money
          value={order.totalPaid}
          className={order.totalPaid > 0 ? "text-success" : "text-muted-foreground"}
        />
      )
    case "totalPending":
      return (
        <Money
          value={order.totalPending}
          className={
            order.totalPending > 0 ? "text-destructive" : "text-muted-foreground"
          }
        />
      )
  }
}

function RowActions({
  order,
  onEdit,
  onDelete,
}: {
  order: PurchaseOrderRow
  onEdit: (order: PurchaseOrderRow) => void
  onDelete: (order: PurchaseOrderRow) => void
}) {
  const canEdit = useCan("purchase_orders", "edit")
  const canDelete = useCan("purchase_orders", "delete")
  const label = order.vendorName || "operational purchase order"

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
      <DropdownMenuContent align="end" className="w-52">
        {canEdit ? (<DropdownMenuItem onClick={() => onEdit(order)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>) : null}
        <DropdownMenuItem
          nativeButton={false}
          render={<Link href={`/purchase-orders/${order.id}`} />}
        >
          <FileText aria-hidden="true" />
          Vendor Payments
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {canDelete ? (<DropdownMenuItem variant="destructive" onClick={() => onDelete(order)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function sortOperationalOrders(
  orders: readonly PurchaseOrderRow[],
  sort: SortState<OperationalColumnId>,
): PurchaseOrderRow[] {
  const direction = sort.direction === "asc" ? 1 : -1

  return [...orders].sort((left, right) => {
    const primary = compareOperational(left, right, sort.key) * direction
    if (primary !== 0) {
      return primary
    }

    const byDate = right.issuedOn.localeCompare(left.issuedOn)
    if (byDate !== 0) {
      return byDate
    }

    return left.id.localeCompare(right.id)
  })
}

function compareOperational(
  left: PurchaseOrderRow,
  right: PurchaseOrderRow,
  key: OperationalColumnId,
): number {
  switch (key) {
    case "issuedOn":
      return left.issuedOn.localeCompare(right.issuedOn)
    case "workType":
      return left.workType.localeCompare(right.workType, "en", {
        sensitivity: "base",
      })
    case "vendorName":
      return left.vendorName.localeCompare(right.vendorName, "en", {
        sensitivity: "base",
      })
    case "totalValue":
    case "totalPaid":
    case "totalPending":
      return left[key] - right[key]
  }
}
