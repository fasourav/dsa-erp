"use client"

import { ListExport } from "@/components/list-export"
import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useCan, useSeesMoney } from "@/components/access-provider"

import { FileText, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, useSyncExternalStore, useTransition } from "react"

import { deletePurchaseOrder } from "@/app/(app)/purchase-orders/actions"
import { OperationalPurchaseOrdersDialog } from "@/app/(app)/purchase-orders/operational-purchase-orders-dialog"
import { PurchaseOrderFormDialog } from "@/app/(app)/purchase-orders/purchase-order-form-dialog"
import { CustomizeColumns, DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { paymentBalanceStatus, StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  getColumnServerSnapshot,
  getColumnSnapshot,
  subscribeColumnVisibility,
  writeColumnVisibility,
} from "@/lib/purchase-order-column-store"
import { paymentStatusLabel } from "@/lib/payment-status"
import type { ProjectFilter } from "@/lib/purchase-orders"
import {
  dataColumns,
  formatPurchaseOrderDate,
  isOptionalColumn,
  paginatePurchaseOrders,
  purchaseOrderDetailLine,
  purchaseOrderRangeLabel,
  sortPurchaseOrders,
  type ColumnId,
  type ExpenseCategoryOption,
  type ProjectOption,
  type PurchaseOrderRow,
  type SortState,
  type VendorOption,
} from "@/lib/purchase-order-summary"
import { cn } from "@/lib/utils"

export function PurchaseOrdersTable({
  orders,
  projects,
  vendors,
  workTypes,
  expenseCategories,
  projectFilter,
  error,
}: {
  orders: PurchaseOrderRow[]
  projects: ProjectOption[]
  vendors: VendorOption[]
  workTypes: string[]
  expenseCategories: ExpenseCategoryOption[]
  projectFilter: ProjectFilter | null
  error: string | null
}) {
  const canAdd = useCan("purchase_orders", "add")
  const seesMoney = useSeesMoney()

  const visibility = useSyncExternalStore(
    subscribeColumnVisibility,
    getColumnSnapshot,
    getColumnServerSnapshot,
  )
  const [sort, setSort] = useState<SortState>({
    key: "issuedOn",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState("")
  const [listFilter, setListFilter] = useState("all")
  const [formOpen, setFormOpen] = useState(false)
  const [formOperational, setFormOperational] = useState(false)
  const [formOrder, setFormOrder] = useState<PurchaseOrderRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PurchaseOrderRow | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const projectOrders = useMemo(
    () => orders.filter((order) => order.projectId != null),
    [orders],
  )
  const sorted = useMemo(
    () => sortPurchaseOrders(projectOrders, sort),
    [projectOrders, sort],
  )
  const filterOptions = [
    { value: "all", label: "All Statuses" },
    { value: "unpaid", label: "Unpaid" },
    { value: "partial", label: "Partially Paid" },
    { value: "paid", label: "Paid" },
  ]
  const filtered = useMemo(
    () =>
      filterRows(sorted, query, rowText, listFilter, (order) =>
        paymentBalanceStatus(
          order.totalPaid,
          order.totalPending,
          order.totalValue,
        ),
      ),
    [listFilter, query, sorted],
  )
  const pageResult = useMemo(
    () => paginatePurchaseOrders(filtered, page),
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

  function openForm(order: PurchaseOrderRow | null) {
    setFormOrder(order)
    setFormOperational(order != null && order.projectId == null)
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
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Purchase Orders"
        className="mb-0 md:mb-2"
        description={
          projectFilter ? (
            <>
              For {projectFilter.name || "this project"}.{" "}
              <Link
                href="/purchase-orders"
                className="font-semibold text-foreground underline underline-offset-4"
              >
                Show all
              </Link>
            </>
          ) : undefined
        }
        actions={
          <>
            <ListExport
              grid={{
                filename: "purchase-orders",
                title: "Purchase Orders",
                columns: [
                  { header: "Date", kind: "text" },
                  { header: "Project Name", kind: "text" },
                  { header: "Vendor Name", kind: "text" },
                  { header: "Work Type", kind: "text" },
                  { header: "Expense Category", kind: "text" },
                  { header: "Status", kind: "text" },
                  { header: "Purchase Order Value", kind: "money" },
                  { header: "Total Paid", kind: "money" },
                  { header: "Pending Due", kind: "money" },
                ],
                rows: filtered.map((order) => [
                  formatPurchaseOrderDate(order.issuedOn),
                  order.projectName,
                  order.vendorName,
                  order.workType,
                  order.expenseCategoryName,
                  paymentStatusLabel(
                    paymentBalanceStatus(
                      order.totalPaid,
                      order.totalPending,
                      order.totalValue,
                    ),
                  ),
                  seesMoney ? order.totalValue : "Hidden",
                  seesMoney ? order.totalPaid : "Hidden",
                  seesMoney ? order.totalPending : "Hidden",
                ]),
              }}
            />
            <CustomizeColumns
              columns={dataColumns}
              visibility={visibility}
              onVisibilityChange={(id, checked) => {
                if (!isOptionalColumn(id)) {
                  return
                }

                writeColumnVisibility({
                  ...visibility,
                  [id]: checked,
                })
              }}
            />
            <OperationalPurchaseOrdersDialog
              orders={orders}
              vendors={vendors}
              workTypes={workTypes}
              expenseCategories={expenseCategories}
            />
            {canAdd ? (
              <Button type="button" onClick={() => openForm(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Assign Purchase Order
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
        placeholder="Search purchase orders"
        filterLabel="Status"
        filter={listFilter}
        onFilterChange={(value) => {
          setListFilter(value)
          setPage(1)
        }}
        options={filterOptions}
      />
      <DataList
        columns={dataColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(order) => order.id}
        sort={sort}
        onSort={toggleSort}
        visibility={visibility}
        error={error}
        emptyMessage={
          projectFilter
            ? "No Purchase Orders For This Project."
            : "No Purchase Orders Yet."
        }
        rangeText={purchaseOrderRangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Purchase orders pagination"
        mobileItem={(order) => ({
          title: order.vendorName || "—",
          subtitle: [
            purchaseOrderDetailLine(order),
            order.projectName,
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
        renderCell={(order, columnId) => (
          <CellValue order={order} columnId={columnId} />
        )}
        renderActions={(order) => (
          <RowActions order={order} onEdit={openForm} onDelete={askDelete} />
        )}
      />

      <PurchaseOrderFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        purchaseOrder={formOrder}
        projects={projects}
        vendors={vendors}
        workTypes={workTypes}
        expenseCategories={expenseCategories}
        defaultProjectId={projectFilter?.id ?? null}
        operational={formOperational}
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
        title="Delete Purchase Order"
        itemName={pendingDelete?.vendorName}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function CellValue({
  order,
  columnId,
}: {
  order: PurchaseOrderRow
  columnId: ColumnId
}) {
  switch (columnId) {
    case "issuedOn":
      return order.issuedOn ? (
        <span className="text-muted-foreground">{formatPurchaseOrderDate(order.issuedOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "projectName":
      if (order.projectId == null) {
        return <span className="text-ui font-semibold text-muted-foreground">Operational</span>
      }
      return order.projectName ? (
        <span className="text-ui font-semibold">{order.projectName}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "vendorName": {
      const detail = purchaseOrderDetailLine(order)
      return (
        <div className="min-w-0">
          <p
            className={cn(
              "truncate text-ui font-semibold",
              !order.vendorName && "text-muted-foreground",
            )}
          >
            {order.vendorName || "—"}
          </p>
          {detail ? (
            <p className="truncate text-label text-muted-foreground">{detail}</p>
          ) : null}
        </div>
      )
    }
    case "status":
      return (
        <StatusBadge
          status={paymentBalanceStatus(
            order.totalPaid,
            order.totalPending,
            order.totalValue,
          )}
        />
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
  const label = order.vendorName || order.projectName || "purchase order"

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
        {canEdit ? (
          <DropdownMenuItem onClick={() => onEdit(order)}>
            <Pencil aria-hidden="true" />
            Edit
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          nativeButton={false}
          render={<Link href={`/purchase-orders/${order.id}`} />}
        >
          <FileText aria-hidden="true" />
          Vendor Payments
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {canDelete ? (
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(order)}>
            <Trash2 aria-hidden="true" />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
