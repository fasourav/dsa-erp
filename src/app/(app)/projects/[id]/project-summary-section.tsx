"use client"

import Link from "next/link"
import type { ReactNode } from "react"

import {
  ExpenseDonut,
  WeeklyChart,
  expenseSliceStyle,
} from "@/app/(app)/dashboard/dashboard-charts"
import { StatusBadge } from "@/components/status-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatExactBdt } from "@/lib/dashboard-metrics"
import { formatIsoDate } from "@/lib/format"
import type { ProjectOverview } from "@/lib/project-detail"
import { formatPercent } from "@/lib/project-summary"
import { cn } from "@/lib/utils"

export function ProjectSummarySection({
  projectId,
  overview,
}: {
  projectId: string
  overview: ProjectOverview
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Project Value" value={formatExactBdt(overview.projectValue)} />
        <Kpi label="Received" value={formatExactBdt(overview.received)} />
        <Kpi label="Receivable" value={formatExactBdt(overview.receivable)} />
        <Kpi label="Paid To Vendors" value={formatExactBdt(overview.paidToVendors)} />
        <Kpi label="Payable" value={formatExactBdt(overview.payable)} />
        <Kpi
          label="Gross Profit"
          value={formatExactBdt(overview.grossProfit)}
          detail={margin}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Mini label="Unbilled" value={formatExactBdt(overview.unbilled)} />
        <Mini label="Total Invoiced" value={formatExactBdt(overview.totalInvoiced)} />
        <Mini label="Contract Balance" value={formatExactBdt(overview.contractBalance)} />
        <Mini label="Total Vendor PO Value" value={formatExactBdt(overview.poCommitments)} />
        <Mini label="Operational Expense" value={formatExactBdt(overview.operational)} />
        <Mini label="Tax Paid" value={formatExactBdt(overview.taxPaid)} />
        <Mini label="Profit After Tax" value={formatExactBdt(overview.profitAfterTax)} />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <LegendDot className="bg-chart-1" label="Revenue" />
              <LegendDot className="bg-chart-4" label="Total Expense" />
              <LegendDot className="bg-chart-2" label="Net Profit" />
            </div>
            {overview.months.length > 0 ? (
              <WeeklyChart data={overview.months} />
            ) : (
              <p className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                No Income Or Expenses Yet
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="flex h-full flex-col gap-4">
            {slices.length > 0 ? (
              <>
                <div className="relative">
                  <ExpenseDonut slices={slices} />
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-lg font-semibold tabular-nums">
                      {formatExactBdt(expenseTotal)}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Expense</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {slices.map((slice) => (
                    <div
                      key={slice.key}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        <span className={cn("size-2 shrink-0 rounded-full", slice.swatch)} />
                        <span className="truncate">{slice.label}</span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums">
                        {formatExactBdt(slice.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="flex h-44 items-center justify-center text-sm text-muted-foreground">
                No Expenses Yet
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Recent Payments</h2>
        {overview.recentPayments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Payments Yet.</p>
        ) : (
          <DataTable>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.recentPayments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    {payment.paidOn ? formatIsoDate(payment.paidOn) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatExactBdt(payment.amount)}
                  </TableCell>
                  <TableCell>{payment.method || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Open Invoices</h2>
          <Link
            href={`/accounts/invoices?project=${projectId}`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Client Invoices
          </Link>
        </div>
        {overview.openInvoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Open Invoices.</p>
        ) : (
          <DataTable>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead>Issued On</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Settled</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.openInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    {invoice.issuedOn ? formatIsoDate(invoice.issuedOn) : "—"}
                  </TableCell>
                  <TableCell>{invoice.description || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatExactBdt(invoice.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatExactBdt(invoice.paid)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatExactBdt(invoice.balance)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={invoice.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Open Purchase Orders</h2>
          <Link
            href={`/purchase-orders?project=${projectId}`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Purchase Orders
          </Link>
        </div>
        {overview.openPurchaseOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Open Purchase Orders.</p>
        ) : (
          <DataTable>
            <TableHeader>
              <TableRow className="bg-muted hover:bg-muted">
                <TableHead>Vendor</TableHead>
                <TableHead>Issued On</TableHead>
                <TableHead>Work Type</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Payable</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.openPurchaseOrders.map((po) => (
                <TableRow key={po.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/purchase-orders/${po.id}`}
                      className="underline underline-offset-4"
                    >
                      {po.vendorName || "—"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {po.issuedOn ? formatIsoDate(po.issuedOn) : "—"}
                  </TableCell>
                  <TableCell>{po.workType || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatExactBdt(po.totalValue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatExactBdt(po.paid)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatExactBdt(po.pending)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        )}
      </section>
    </div>
  )
}

function Kpi({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail?: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-lg font-medium tabular-nums">{value}</p>
        {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      </CardContent>
    </Card>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-full", className)} />
      {label}
    </span>
  )
}

function DataTable({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <Table className="min-w-max">{children}</Table>
      </div>
    </div>
  )
}
