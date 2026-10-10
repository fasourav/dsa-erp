"use client"

import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { StatusBadge } from "@/components/status-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatIsoDate, formatMoney } from "@/lib/format"
import type {
  BacklogEntry,
  LinkedInvoice,
  LinkedPO,
  ProjectDetail,
  ProjectFinancial,
} from "@/lib/project-detail"

export function ProjectDetailPanel({
  project,
  financial,
  purchaseOrders,
  invoices,
  backlog,
}: {
  project: ProjectDetail
  financial: ProjectFinancial | null
  purchaseOrders: LinkedPO[]
  invoices: LinkedInvoice[]
  backlog: BacklogEntry | null
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          nativeButton={false}
          render={<Link href="/projects" aria-label="Back to projects" />}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-medium tracking-tight">
            {project.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="rounded-full capitalize">
              {project.status}
            </Badge>
            {project.projectType ? (
              <span>{project.projectType}</span>
            ) : null}
            {project.currentPhase ? (
              <span>· {project.currentPhase}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Project Info</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <InfoRow label="Client" value={project.clientName} />
            <InfoRow label="Location" value={project.location} />
            <InfoRow
              label="Started On"
              value={
                project.startedOn ? formatIsoDate(project.startedOn) : ""
              }
            />
            {project.completedOn ? (
              <InfoRow
                label="Completed On"
                value={formatIsoDate(project.completedOn)}
              />
            ) : null}
            <InfoRow
              label="Total Value"
              value={formatMoney(project.totalValue)}
            />
            {project.details ? (
              <div>
                <span className="text-muted-foreground">Details</span>
                <p className="mt-1 whitespace-pre-wrap">{project.details}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {financial ? (
          <Card>
            <CardHeader>
              <CardTitle>Financial Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <InfoRow
                label="Total Value"
                value={formatMoney(financial.totalValue)}
              />
              <InfoRow
                label="Total Paid"
                value={formatMoney(financial.totalPaid)}
              />
              <InfoRow
                label="Pending Due"
                value={formatMoney(financial.totalPendingDue)}
              />
              <InfoRow
                label="Expenses"
                value={formatMoney(financial.expenseTotal)}
              />
              <InfoRow
                label="Expense Due"
                value={formatMoney(financial.expenseDue)}
              />
              <InfoRow
                label="Gross Profit"
                value={formatMoney(financial.grossProfit)}
              />
              <InfoRow
                label="Backlog"
                value={formatMoney(financial.backlogAmount)}
              />
            </CardContent>
          </Card>
        ) : null}
      </div>

      {purchaseOrders.length > 0 ? (
        <div>
          <h2 className="mb-3 text-lg font-medium">Purchase Orders</h2>
          <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead>Vendor</TableHead>
                    <TableHead>Issued On</TableHead>
                    <TableHead>Work Type</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/purchase-orders/${po.id}`}
                          className="underline underline-offset-4"
                        >
                          {po.vendorName || "—"}
                        </Link>
                      </TableCell>
                      <TableCell>{formatIsoDate(po.issuedOn)}</TableCell>
                      <TableCell>{po.workType || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(po.totalValue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : null}

      {invoices.length > 0 ? (
        <div>
          <h2 className="mb-3 text-lg font-medium">Client Invoices</h2>
          <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <Table className="min-w-max">
                <TableHeader>
                  <TableRow className="bg-muted hover:bg-muted">
                    <TableHead>Issued On</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{formatIsoDate(inv.issuedOn)}</TableCell>
                      <TableCell>{inv.description || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(inv.amount)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={inv.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      ) : null}

      {backlog ? (
        <Card>
          <CardHeader>
            <CardTitle>Backlog</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <InfoRow
              label="Project Value"
              value={formatMoney(backlog.projectValue)}
            />
            <InfoRow
              label="Backlog Amount"
              value={formatMoney(backlog.backlogAmount)}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  )
}
