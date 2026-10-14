"use client"

import { Inbox } from "lucide-react"
import Link from "next/link"
import { useMemo, useState, type ReactNode } from "react"

import {
  ExpenseDonut,
  WeeklyChart,
  expenseSliceStyle,
} from "@/app/(app)/dashboard/dashboard-charts"
import { DataList, type DataListMobileItem } from "@/components/data-list"
import { Money } from "@/components/money"
import { RecordAttachments } from "@/components/record-attachments"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatIsoDate } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import type {
  BacklogEntry,
  OpenInvoice,
  OpenPurchaseOrder,
  ProjectDetail,
  ProjectOverview,
  RecentClientPayment,
} from "@/lib/project-detail"
import { formatPercent } from "@/lib/project-summary"
import { cn } from "@/lib/utils"

type PaymentColumn = "paidOn" | "amount" | "method"
type InvoiceColumn = "issuedOn" | "description" | "amount" | "paid" | "balance" | "status"
type PurchaseColumn = "vendorName" | "issuedOn" | "workType" | "totalValue" | "paid" | "pending"

const paymentColumns: readonly ListColumn<PaymentColumn>[] = [
  { id: "paidOn", label: "Date", align: "left", locked: true },
  { id: "amount", label: "Amount", align: "right", locked: true },
  { id: "method", label: "Method", align: "left", locked: true },
]

const invoiceColumns: readonly ListColumn<InvoiceColumn>[] = [
  { id: "issuedOn", label: "Issued On", align: "left", locked: true },
  { id: "description", label: "Description", align: "left", locked: true },
  { id: "amount", label: "Amount", align: "right", locked: true },
  { id: "paid", label: "Settled", align: "right", locked: true },
  { id: "balance", label: "Balance", align: "right", locked: true },
  { id: "status", label: "Status", align: "left", locked: true },
]

const purchaseColumns: readonly ListColumn<PurchaseColumn>[] = [
  { id: "vendorName", label: "Vendor", align: "left", locked: true },
  { id: "issuedOn", label: "Issued On", align: "left", locked: true },
  { id: "workType", label: "Work Type", align: "left", locked: true },
  { id: "totalValue", label: "Value", align: "right", locked: true },
  { id: "paid", label: "Paid", align: "right", locked: true },
  { id: "pending", label: "Payable", align: "right", locked: true },
]

export function ProjectSummarySection({
  project,
  overview,
  backlog,
}: {
  project: ProjectDetail
  overview: ProjectOverview
  backlog: BacklogEntry | null
}) {
  const slices = expenseSliceStyle.flatMap((style) => {
    const amount =
      overview.breakdown.find((row) => row.key === style.key)?.amount ?? 0
    if (amount <= 0) return []
    return [{ ...style, amount }]
  })
  const expenseTotal = slices.reduce((total, slice) => total + slice.amount, 0)
  const margin = formatPercent(overview.grossProfit, overview.projectValue)

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4 xl:grid-cols-6">
        <Kpi label="Project Value" value={overview.projectValue} />
        <Kpi label="Received" value={overview.received} />
        <Kpi label="Receivable" value={overview.receivable} />
        <Kpi label="Paid To Vendors" value={overview.paidToVendors} />
        <Kpi label="Payable" value={overview.payable} />
        <Kpi
          label="Gross Profit"
          value={overview.grossProfit}
          detail={`${margin} Margin`}
          className={overview.grossProfit < 0 ? "text-destructive" : undefined}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        <Mini label="Unbilled" value={overview.unbilled} />
        <Mini label="Total Invoiced" value={overview.totalInvoiced} />
        <Mini label="Contract Balance" value={overview.contractBalance} />
        <Mini label="Total Vendor PO Value" value={overview.poCommitments} />
        <Mini label="Operational Expense" value={overview.operational} />
        <Mini label="Tax Paid" value={overview.taxPaid} />
        <Mini label="Profit After Tax" value={overview.profitAfterTax} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="info">Project Info</TabsTrigger>
        </TabsList>

        <TabsContent keepMounted value="overview">
          <div className="grid grid-cols-1 items-stretch gap-2.5 md:grid-cols-2 md:gap-4">
            <Card className="h-full gap-0">
              <CardHeader>
                <h2 className="text-panel-title font-bold md:font-strong">Income vs Expenses</h2>
              </CardHeader>
              <CardContent className="flex h-full flex-col gap-4">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <LegendDot className="bg-chart-1" label="Revenue" />
                  <LegendDot className="bg-chart-3" label="Total Expense" />
                  <LegendDot className="bg-chart-2" label="Net Profit" />
                </div>
                {overview.months.length > 0 ? (
                  <WeeklyChart data={overview.months} />
                ) : (
                  <ChartEmpty message="No Income Or Expenses Yet" />
                )}
              </CardContent>
            </Card>

            <Card className="h-full gap-0">
              <CardHeader>
                <h2 className="text-panel-title font-bold md:font-strong">Expense Breakdown</h2>
              </CardHeader>
              <CardContent className="flex h-full flex-col gap-4">
                {slices.length > 0 ? (
                  <>
                    <div className="relative">
                      <ExpenseDonut slices={slices} />
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-stat">
                          <Money value={expenseTotal} />
                        </p>
                        <p className="text-caption text-muted-foreground">Total Expense</p>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      {slices.map((slice) => (
                        <div
                          key={slice.key}
                          className="flex items-center justify-between gap-3 border-t border-border py-2.5 text-ui first:border-t-0"
                        >
                          <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                            <span className={cn("size-2 shrink-0 rounded-full", slice.swatch)} />
                            <span className="truncate">{slice.label}</span>
                          </span>
                          <Money value={slice.amount} />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <ChartEmpty message="No Expenses Yet" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent keepMounted value="payments" className="flex flex-col gap-3">
          <h2 className="px-1 text-panel-title font-bold md:px-0 md:font-strong">Recent Payments</h2>
          <RecordList
            columns={paymentColumns}
            rows={overview.recentPayments}
            rowKey={(payment) => payment.id}
            emptyMessage="No Payments Yet."
            pagingLabel="Recent payments pagination"
            singular="payment"
            plural="payments"
            initialSort={{ key: "paidOn", direction: "desc" }}
            sortValue={paymentSortValue}
            mobileItem={(payment) => ({
              title: <Money value={payment.amount} />,
              subtitle: [payment.paidOn ? formatIsoDate(payment.paidOn) : "", payment.method]
                .filter(Boolean)
                .join(" · "),
            })}
            renderCell={(payment, columnId) => (
              <PaymentCell payment={payment} columnId={columnId} />
            )}
          />
        </TabsContent>

        <TabsContent keepMounted value="invoices" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 md:px-0">
            <h2 className="text-panel-title font-bold md:font-strong">Open Invoices</h2>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/accounts/invoices?project=${project.id}`} />}
            >
              Client Invoices
            </Button>
          </div>
          <RecordList
            columns={invoiceColumns}
            rows={overview.openInvoices}
            rowKey={(invoice) => invoice.id}
            emptyMessage="No Open Invoices."
            pagingLabel="Open invoices pagination"
            singular="invoice"
            plural="invoices"
            initialSort={{ key: "issuedOn", direction: "desc" }}
            sortValue={invoiceSortValue}
            mobileItem={(invoice) => ({
              title: invoice.description || "—",
              value: <StatusBadge status={invoice.status} />,
              subtitle: invoice.issuedOn
                ? `Issued On ${formatIsoDate(invoice.issuedOn)}`
                : undefined,
              meta: <Money value={invoice.balance} />,
            })}
            renderCell={(invoice, columnId) => (
              <InvoiceCell invoice={invoice} columnId={columnId} />
            )}
          />
        </TabsContent>

        <TabsContent keepMounted value="orders" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 md:px-0">
            <h2 className="text-panel-title font-bold md:font-strong">Open Purchase Orders</h2>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/purchase-orders?project=${project.id}`} />}
            >
              Purchase Orders
            </Button>
          </div>
          <RecordList
            columns={purchaseColumns}
            rows={overview.openPurchaseOrders}
            rowKey={(order) => order.id}
            emptyMessage="No Open Purchase Orders."
            pagingLabel="Open purchase orders pagination"
            singular="order"
            plural="orders"
            initialSort={{ key: "issuedOn", direction: "desc" }}
            sortValue={purchaseSortValue}
            mobileItem={(order) => ({
              title: (
                <Link
                  href={`/purchase-orders/${order.id}`}
                  className="block truncate underline-offset-4 hover:underline"
                >
                  {order.vendorName || "—"}
                </Link>
              ),
              value: <Money value={order.pending} />,
              subtitle: [
                order.workType,
                order.issuedOn ? `Issued On ${formatIsoDate(order.issuedOn)}` : "",
              ]
                .filter(Boolean)
                .join(" · "),
              meta: <span className="text-label text-muted-foreground">Payable</span>,
            })}
            renderCell={(order, columnId) => (
              <PurchaseCell order={order} columnId={columnId} />
            )}
          />
        </TabsContent>

        <TabsContent keepMounted value="info" className="flex flex-col gap-4">
          <Card className="gap-0">
            <CardHeader>
              <h2 className="text-panel-title font-bold md:font-strong">Project Info</h2>
            </CardHeader>
            <CardContent>
              <dl>
                {project.currentPhase ? (
                  <InfoRow label="Phase">{project.currentPhase}</InfoRow>
                ) : null}
                <InfoRow label="Started On">
                  {project.startedOn ? formatIsoDate(project.startedOn) : "—"}
                </InfoRow>
                {project.completedOn ? (
                  <InfoRow label="Completed On">{formatIsoDate(project.completedOn)}</InfoRow>
                ) : null}
                {project.details ? (
                  <div className="flex flex-col gap-1 border-t border-border py-3">
                    <dt className="text-muted-foreground">Details</dt>
                    <dd className="whitespace-pre-wrap">{project.details}</dd>
                  </div>
                ) : null}
              </dl>
            </CardContent>
          </Card>

          {backlog ? (
            <Card className="gap-0">
              <CardHeader>
                <h2 className="text-panel-title font-bold md:font-strong">Backlog</h2>
              </CardHeader>
              <CardContent>
                <dl>
                  <InfoRow label="Project Value">
                    <Money value={backlog.projectValue} />
                  </InfoRow>
                  <InfoRow label="Backlog Amount">
                    <Money value={backlog.backlogAmount} />
                  </InfoRow>
                </dl>
              </CardContent>
            </Card>
          ) : null}

          <RecordAttachments parentType="project" parentId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function RecordList<T, Id extends string>({
  columns,
  rows,
  rowKey,
  emptyMessage,
  pagingLabel,
  singular,
  plural,
  initialSort,
  sortValue,
  mobileItem,
  renderCell,
}: {
  columns: readonly ListColumn<Id>[]
  rows: readonly T[]
  rowKey: (row: T) => string
  emptyMessage: string
  pagingLabel: string
  singular: string
  plural: string
  initialSort: SortState<Id>
  sortValue: (row: T, key: Id) => string | number
  mobileItem: (row: T) => DataListMobileItem
  renderCell: (row: T, columnId: Id) => ReactNode
}) {
  const [sort, setSort] = useState(initialSort)
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => {
    const direction = sort.direction === "asc" ? 1 : -1
    return [...rows].sort(
      (left, right) =>
        compareSortValues(sortValue(left, sort.key), sortValue(right, sort.key)) * direction,
    )
  }, [rows, sort, sortValue])
  const pageResult = useMemo(() => paginateRows(sorted, page), [page, sorted])

  return (
    <DataList
      columns={columns}
      rows={pageResult.rows}
      rowKey={rowKey}
      sort={sort}
      onSort={(key) => {
        setSort((current) => toggleSort(current, key))
        setPage(1)
      }}
      visibility={{}}
      error={null}
      emptyMessage={emptyMessage}
      rangeText={rangeLabel(
        pageResult.rangeStart,
        pageResult.rangeEnd,
        pageResult.total,
        singular,
        plural,
      )}
      currentPage={pageResult.currentPage}
      pageCount={pageResult.pageCount}
      onPageChange={setPage}
      pagingLabel={pagingLabel}
      mobileItem={mobileItem}
      renderCell={renderCell}
    />
  )
}

function compareSortValues(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") {
    return left - right
  }

  return String(left).localeCompare(String(right), "en", { sensitivity: "base" })
}

function paymentSortValue(row: RecentClientPayment, key: PaymentColumn) {
  switch (key) {
    case "paidOn":
      return row.paidOn
    case "amount":
      return row.amount
    case "method":
      return row.method
  }
}

function invoiceSortValue(row: OpenInvoice, key: InvoiceColumn) {
  switch (key) {
    case "issuedOn":
      return row.issuedOn
    case "description":
      return row.description
    case "amount":
      return row.amount
    case "paid":
      return row.paid
    case "balance":
      return row.balance
    case "status":
      return row.status
  }
}

function purchaseSortValue(row: OpenPurchaseOrder, key: PurchaseColumn) {
  switch (key) {
    case "vendorName":
      return row.vendorName
    case "issuedOn":
      return row.issuedOn
    case "workType":
      return row.workType
    case "totalValue":
      return row.totalValue
    case "paid":
      return row.paid
    case "pending":
      return row.pending
  }
}

function PaymentCell({
  payment,
  columnId,
}: {
  payment: RecentClientPayment
  columnId: PaymentColumn
}) {
  switch (columnId) {
    case "paidOn":
      return payment.paidOn ? (
        formatIsoDate(payment.paidOn)
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "amount":
      return <Money value={payment.amount} />
    case "method":
      return payment.method || <span className="text-muted-foreground">—</span>
  }
}

function InvoiceCell({
  invoice,
  columnId,
}: {
  invoice: OpenInvoice
  columnId: InvoiceColumn
}) {
  switch (columnId) {
    case "issuedOn":
      return invoice.issuedOn ? (
        formatIsoDate(invoice.issuedOn)
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "description":
      return invoice.description || <span className="text-muted-foreground">—</span>
    case "amount":
      return <Money value={invoice.amount} />
    case "paid":
      return <Money value={invoice.paid} />
    case "balance":
      return <Money value={invoice.balance} />
    case "status":
      return <StatusBadge status={invoice.status} />
  }
}

function PurchaseCell({
  order,
  columnId,
}: {
  order: OpenPurchaseOrder
  columnId: PurchaseColumn
}) {
  switch (columnId) {
    case "vendorName":
      return (
        <Button
          type="button"
          variant="link"
          nativeButton={false}
          render={<Link href={`/purchase-orders/${order.id}`} />}
          className="h-auto min-h-8 px-0 text-ui font-semibold text-foreground"
        >
          {order.vendorName || "—"}
        </Button>
      )
    case "issuedOn":
      return order.issuedOn ? (
        formatIsoDate(order.issuedOn)
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "workType":
      return order.workType || <span className="text-muted-foreground">—</span>
    case "totalValue":
      return <Money value={order.totalValue} />
    case "paid":
      return <Money value={order.paid} />
    case "pending":
      return <Money value={order.pending} />
  }
}

function Kpi({
  label,
  value,
  detail,
  className,
}: {
  label: string
  value: number
  detail?: string
  className?: string
}) {
  return (
    <Card className="min-w-0 gap-1">
      <CardContent className="flex min-w-0 flex-col gap-1">
        <p className="text-label text-muted-foreground">{label}</p>
        <p className={cn("min-w-0 truncate text-kpi", className)}>
          <Money value={value} size="kpi" />
        </p>
        {detail ? <p className="text-caption text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  )
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm" className="min-w-0 gap-1">
      <CardContent className="flex min-w-0 flex-col gap-1">
        <p className="text-caption text-muted-foreground">{label}</p>
        <p className="min-w-0 truncate text-metric">
          <Money value={value} />
        </p>
      </CardContent>
    </Card>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-muted-foreground">
      <span className={cn("size-2.5 rounded-full", className)} />
      {label}
    </span>
  )
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <Empty className="min-h-44">
      <EmptyMedia variant="icon">
        <Inbox aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>{message}</EmptyTitle>
    </Empty>
  )
}

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-t border-border py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{children}</dd>
    </div>
  )
}
