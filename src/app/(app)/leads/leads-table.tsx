"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useCan } from "@/components/access-provider"

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
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
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
  type SortState,
} from "@/lib/list-paging"
import { compareText, formatDayMonYear, formatIsoDate } from "@/lib/format"
import type { LeadLookups, LeadRow } from "@/lib/leads"
import { useListUrlState } from "@/lib/use-list-url-state"
import { cn } from "@/lib/utils"

const leadSortKeys = dataColumns.map((column) => column.id)
const defaultLeadSort: SortState<ColumnId> = {
  key: "addedOn",
  direction: "desc",
}

function sortLeads(rows: LeadRow[], sort: SortState<ColumnId>): LeadRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case "leadName":
        cmp = compareText(a.leadName, b.leadName)
        break
      case "addedOn":
        cmp = a.addedOn.localeCompare(b.addedOn)
        break
      case "projectName":
        cmp = compareText(a.projectName, b.projectName)
        break
      case "currentStage":
        cmp = compareText(a.currentStage, b.currentStage)
        break
      case "source":
        cmp = compareText(a.source, b.source)
        break
      case "estimatedValue":
        cmp = a.estimatedValue - b.estimatedValue
        break
      case "probability":
        cmp = a.probability - b.probability
        break
      case "status":
        cmp = compareText(a.statusLabel, b.statusLabel)
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
  initialQuery?: string
}) {
  const canAdd = useCan("leads", "add")
  const canEdit = useCan("leads", "edit")

  const visibility = useSyncExternalStore(
    subscribeColumnVisibility,
    getColumnSnapshot,
    getColumnServerSnapshot,
  )
  const filterOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const lead of leads) {
      if (lead.status) seen.set(lead.status, lead.statusLabel || lead.status)
    }
    return [
      { value: "all", label: "All Statuses" },
      ...[...seen.entries()].map(([value, label]) => ({ value, label })),
    ]
  }, [leads])
  const leadFilterValues = useMemo(
    () => filterOptions.map((option) => option.value),
    [filterOptions],
  )
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
    sortKeys: leadSortKeys,
    defaultSort: defaultLeadSort,
    facet: { key: "status", options: leadFilterValues },
  })
  const [formOpen, setFormOpen] = useState(false)
  const [formLead, setFormLead] = useState<LeadRow | null>(null)
  const [formMode, setFormMode] = useState<"view" | "edit">("edit")
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<LeadRow | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()
  const [converting, startConvert] = useTransition()
  const [convertError, setConvertError] = useState<string | null>(null)

  const sorted = useMemo(() => sortLeads(leads, sort), [leads, sort])
  const filtered = useMemo(
    () => filterRows(sorted, query, rowText, listFilter, (lead) => lead.status),
    [listFilter, query, sorted],
  )
  const pageResult = useMemo(() => paginateRows(filtered, page), [filtered, page])

  function openForm(lead: LeadRow | null) {
    setFormLead(lead)
    setFormMode("edit")
    setFormSession((s) => s + 1)
    setFormOpen(true)
  }

  function openView(lead: LeadRow) {
    setFormLead(lead)
    setFormMode("view")
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
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Leads"
        className="mb-0 md:mb-2"
        actions={
          <>
            <ListExport
              grid={{
                filename: "leads",
                title: "Leads",
                columns: [
                  { header: "Lead Name", kind: "text" },
                  { header: "Lead Add Date", kind: "text" },
                  { header: "Project Name", kind: "text" },
                  { header: "Stage", kind: "text" },
                  { header: "Source", kind: "text" },
                  { header: "Est. Value", kind: "money" },
                  { header: "Probability", kind: "integer" },
                  { header: "Status", kind: "text" },
                ],
                rows: filtered.map((lead) => [
                  lead.leadName,
                  formatDayMonYear(lead.addedOn),
                  lead.projectName,
                  lead.currentStage,
                  lead.source,
                  lead.estimatedValue,
                  lead.probability,
                  lead.statusLabel,
                ]),
              }}
            />
            {canAdd ? (
              <Button type="button" onClick={() => openForm(null)}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                Add New Lead
              </Button>
            ) : null}
          </>
        }
      />

      {convertError ? (
        <p role="alert" className="text-sm text-destructive">
          {convertError}
        </p>
      ) : null}

      <ListSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Search leads"
        filterLabel="Status"
        filter={listFilter}
        onFilterChange={setListFilter}
        options={filterOptions}
      />
      <DataList
        columns={dataColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(lead) => lead.id}
        sort={sort}
        onSort={onSort}
        visibility={visibility}
        error={error}
        emptyMessage="No Leads Yet."
        emptyState={
          leads.length === 0 && !hasActiveFilters
            ? {
                kind: "none",
                action: canAdd ? (
                  <Button type="button" onClick={() => openForm(null)}>
                    <Plus aria-hidden="true" data-icon="inline-start" />
                    Add New Lead
                  </Button>
                ) : undefined,
              }
            : { kind: "filtered", onClearFilters: clearFilters }
        }
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
        mobileItem={(lead) => ({
          title: (
            <Button
              type="button"
              variant="link"
              className={cn(
                "h-auto min-h-8 px-0 text-row font-semibold text-foreground",
                !lead.leadName && "text-muted-foreground",
              )}
              aria-label={`Open details for ${lead.leadName || "lead"}`}
              onClick={() => openView(lead)}
            >
              {lead.leadName || "—"}
            </Button>
          ),
          value: <StatusBadge status={lead.status} />,
          subtitle: [lead.projectName, lead.currentStage].filter(Boolean).join(" · "),
          meta: <Money value={lead.estimatedValue} />,
        })}
        renderCell={(lead, columnId) => (
          <CellValue lead={lead} columnId={columnId} onView={openView} />
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
        readOnly={formMode === "view"}
        onEdit={canEdit && formLead ? () => setFormMode("edit") : undefined}
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
        title="Delete Lead"
        itemName={pendingDelete?.leadName}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </div>
  )
}

function CellValue({
  lead,
  columnId,
  onView,
}: {
  lead: LeadRow
  columnId: ColumnId
  onView: (lead: LeadRow) => void
}) {
  switch (columnId) {
    case "leadName":
      return (
        <div className="flex w-full min-w-0 flex-col items-start gap-1.5">
          <Button
            type="button"
            variant="link"
            title={lead.leadName || undefined}
            className={cn(
              "h-auto max-w-full min-h-8 truncate px-0 text-left text-ui font-semibold text-foreground",
              !lead.leadName && "text-muted-foreground",
            )}
            aria-label={`Open details for ${lead.leadName || "lead"}`}
            onClick={() => onView(lead)}
          >
            {lead.leadName || "—"}
          </Button>
          {lead.kindLabel ? <Badge variant="outline">{lead.kindLabel}</Badge> : null}
        </div>
      )
    case "addedOn":
      return lead.addedOn ? (
        <span>{formatIsoDate(lead.addedOn)}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "projectName":
      return (
        <div className="flex w-full min-w-0 flex-col gap-1">
          <span className={cn(!lead.projectName && "text-muted-foreground")}>
            {lead.projectName || "—"}
          </span>
          {lead.projectType ? (
            <Badge variant="secondary">{lead.projectType}</Badge>
          ) : null}
        </div>
      )
    case "currentStage":
      return lead.currentStage ? (
        <Badge variant="outline">{lead.currentStage}</Badge>
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
      return <Money value={lead.estimatedValue} />
    case "probability":
      return (
        <span className="tabular-nums">
          {Number.isFinite(lead.probability) ? `${lead.probability}%` : "—"}
        </span>
      )
    case "status":
      return <StatusBadge status={lead.status} />
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
  const canEdit = useCan("leads", "edit")
  const canDelete = useCan("leads", "delete")
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
        {canEdit ? (<DropdownMenuItem onClick={() => onEdit(lead)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>) : null}
        {canEdit ? (<DropdownMenuItem
          disabled={alreadyConverted || converting}
          onClick={() => onConvert(lead)}
        >
          <ArrowRightLeft aria-hidden="true" />
          Convert To Client
        </DropdownMenuItem>) : null}
        <DropdownMenuSeparator />
        {canDelete ? (<DropdownMenuItem variant="destructive" onClick={() => onDelete(lead)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
