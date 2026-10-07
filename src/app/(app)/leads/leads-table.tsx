"use client"

import {
  ArrowRightLeft,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useMemo, useState, useSyncExternalStore, useTransition } from "react"

import {
  convertLead,
  deleteLead,
} from "@/app/(app)/leads/actions"
import { LeadFormDialog } from "@/app/(app)/leads/lead-form-dialog"
import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
import { DataList } from "@/components/data-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  getColumnServerSnapshot,
  getColumnSnapshot,
  subscribeColumnVisibility,
} from "@/lib/lead-column-store"
import {
  dataColumns,
  type ColumnId,
} from "@/lib/lead-summary"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { formatIsoDate, formatMoney } from "@/lib/format"
import type { LeadLookups, LeadRow } from "@/lib/leads"
import { cn } from "@/lib/utils"

function sortLeads(rows: LeadRow[], sort: SortState<ColumnId>): LeadRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case "leadName":
        cmp = a.leadName.localeCompare(b.leadName, "en", { sensitivity: "base" })
        break
      case "createdOn":
        cmp = a.createdOn.localeCompare(b.createdOn)
        break
      case "projectName":
        cmp = a.projectName.localeCompare(b.projectName, "en", {
          sensitivity: "base",
        })
        break
      case "currentStage":
        cmp = a.currentStage.localeCompare(b.currentStage, "en", {
          sensitivity: "base",
        })
        break
      case "source":
        cmp = a.source.localeCompare(b.source, "en", { sensitivity: "base" })
        break
      case "estimatedValue":
        cmp = a.estimatedValue - b.estimatedValue
        break
      case "probability":
        cmp = a.probability - b.probability
        break
      case "status":
        cmp = a.statusLabel.localeCompare(b.statusLabel, "en", {
          sensitivity: "base",
        })
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })
  return sorted
}

export function LeadsTable({
  leads,
  lookups,
  error,
}: {
  leads: LeadRow[]
  lookups: LeadLookups
  error: string | null
}) {
  const visibility = useSyncExternalStore(
    subscribeColumnVisibility,
    getColumnSnapshot,
    getColumnServerSnapshot,
  )
  const [sort, setSort] = useState<SortState<ColumnId>>({
    key: "createdOn",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formLead, setFormLead] = useState<LeadRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<LeadRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()
  const [converting, startConvert] = useTransition()
  const [convertError, setConvertError] = useState<string | null>(null)

  const sorted = useMemo(() => sortLeads(leads, sort), [leads, sort])
  const pageResult = useMemo(() => paginateRows(sorted, page), [sorted, page])

  function openForm(lead: LeadRow | null) {
    setFormLead(lead)
    setFormSession((s) => s + 1)
    setFormOpen(true)
  }

  function askDelete(lead: LeadRow) {
    setDeleteError(null)
    setPendingDelete(lead)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteLead(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }
        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this lead.")
      }
    })
  }

  function handleConvert(lead: LeadRow) {
    setConvertError(null)
    startConvert(async () => {
      try {
        const result = await convertLead(lead.id)
        if (result.error) {
          setConvertError(result.error)
        }
      } catch {
        setConvertError("Could not convert this lead.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Leads</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => openForm(null)}>
            <Plus aria-hidden="true" data-icon="inline-start" />
            Add New Lead
          </Button>
        </div>
      </div>

      {convertError ? (
        <p role="alert" className="text-sm text-destructive">
          {convertError}
        </p>
      ) : null}

      <DataList
        columns={dataColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(lead) => lead.id}
        sort={sort}
        onSort={(key) => {
          setSort(toggleSort(sort, key))
          setPage(1)
        }}
        visibility={visibility}
        error={error}
        emptyMessage="No Leads Yet."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "lead",
          "leads",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Leads pagination"
        renderCell={(lead, columnId) => (
          <CellValue lead={lead} columnId={columnId} />
        )}
        renderActions={(lead) => (
          <RowActions
            lead={lead}
            converting={converting}
            onEdit={openForm}
            onConvert={handleConvert}
            onDelete={askDelete}
          />
        )}
      />

      <LeadFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={formLead}
        lookups={lookups}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">
                {pendingDelete?.leadName || "this lead"}
              </span>
              . Hold Delete to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <HoldToDeleteButton pending={deleting} onConfirm={confirmDelete} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function CellValue({
  lead,
  columnId,
}: {
  lead: LeadRow
  columnId: ColumnId
}) {
  switch (columnId) {
    case "leadName":
      return (
        <div className="flex min-w-40 flex-col gap-1 whitespace-normal">
          <span className={cn("font-medium", !lead.leadName && "text-muted-foreground")}>
            {lead.leadName || "—"}
          </span>
          {lead.kindLabel ? (
            <Badge variant="outline" className="w-fit rounded-full">
              {lead.kindLabel}
            </Badge>
          ) : null}
        </div>
      )
    case "createdOn":
      return lead.createdOn ? (
        <span>{formatIsoDate(lead.createdOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "projectName":
      return (
        <div className="flex min-w-40 flex-col gap-1 whitespace-normal">
          <span className={cn(!lead.projectName && "text-muted-foreground")}>
            {lead.projectName || "—"}
          </span>
          {lead.projectType ? (
            <Badge variant="secondary" className="w-fit rounded-full">
              {lead.projectType}
            </Badge>
          ) : null}
        </div>
      )
    case "currentStage":
      return lead.currentStage ? (
        <Badge variant="outline" className="rounded-full">
          {lead.currentStage}
        </Badge>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "source":
      return lead.source ? (
        <span>{lead.source}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "estimatedValue":
      return (
        <span className="tabular-nums">{formatMoney(lead.estimatedValue)}</span>
      )
    case "probability":
      return (
        <span className="tabular-nums">
          {Number.isFinite(lead.probability) ? `${lead.probability}%` : "—"}
        </span>
      )
    case "status":
      return (
        <Badge
          variant={
            lead.status === "won"
              ? "secondary"
              : lead.status === "lost" || lead.status === "cancelled"
                ? "destructive"
                : "outline"
          }
          className="rounded-full"
        >
          {lead.statusLabel}
        </Badge>
      )
  }
}

function RowActions({
  lead,
  converting,
  onEdit,
  onConvert,
  onDelete,
}: {
  lead: LeadRow
  converting: boolean
  onEdit: (lead: LeadRow) => void
  onConvert: (lead: LeadRow) => void
  onDelete: (lead: LeadRow) => void
}) {
  const alreadyConverted = Boolean(
    lead.convertedClientId || lead.convertedProjectId,
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${lead.leadName || "lead"}`}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={() => onEdit(lead)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={alreadyConverted || converting}
          onClick={() => onConvert(lead)}
        >
          <ArrowRightLeft aria-hidden="true" />
          Convert To Client
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(lead)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
