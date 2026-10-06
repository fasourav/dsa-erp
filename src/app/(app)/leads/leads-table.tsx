"use client"

import {
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useMemo, useState, useTransition } from "react"

import {
  convertLead,
  deleteLead,
} from "@/app/(app)/leads/actions"
import { LeadFormDialog } from "@/app/(app)/leads/lead-form-dialog"
import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  paginateRows,
  paginationItems,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { formatMoney } from "@/lib/format"
import type { LeadRow, ProjectTypeOption } from "@/lib/leads"
import { cn } from "@/lib/utils"

type ColId = "leadName" | "kind" | "status" | "projectType" | "estimatedValue" | "probability"

const columns: { id: ColId; label: string; align: "left" | "right" }[] = [
  { id: "leadName", label: "Lead Name", align: "left" },
  { id: "kind", label: "Type", align: "left" },
  { id: "status", label: "Status", align: "left" },
  { id: "projectType", label: "Project Type", align: "left" },
  { id: "estimatedValue", label: "Est. Value", align: "right" },
  { id: "probability", label: "Prob. %", align: "right" },
]

function sortLeads(rows: LeadRow[], sort: SortState<ColId>): LeadRow[] {
  const sorted = [...rows]
  sorted.sort((a, b) => {
    let cmp = 0
    switch (sort.key) {
      case "leadName":
        cmp = a.leadName.localeCompare(b.leadName, "en", { sensitivity: "base" })
        break
      case "kind":
        cmp = a.kind.localeCompare(b.kind)
        break
      case "status":
        cmp = a.status.localeCompare(b.status)
        break
      case "projectType":
        cmp = a.projectType.localeCompare(b.projectType, "en", { sensitivity: "base" })
        break
      case "estimatedValue":
        cmp = a.estimatedValue - b.estimatedValue
        break
      case "probability":
        cmp = a.probability - b.probability
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })
  return sorted
}

function statusBadge(status: string) {
  switch (status) {
    case "won":
      return "secondary"
    case "lost":
      return "destructive"
    default:
      return "outline"
  }
}

export function LeadsTable({
  leads,
  projectTypes,
  error,
}: {
  leads: LeadRow[]
  projectTypes: ProjectTypeOption[]
  error: string | null
}) {
  const [sort, setSort] = useState<SortState<ColId>>({
    key: "leadName",
    direction: "asc",
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
  const pages = paginationItems(pageResult.currentPage, pageResult.pageCount)

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
        <Button type="button" onClick={() => openForm(null)}>
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add New Lead
        </Button>
      </div>

      {convertError ? (
        <p role="alert" className="text-sm text-destructive">
          {convertError}
        </p>
      ) : null}

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <Table className="min-w-max">
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              {columns.map((col) => {
                const active = sort.key === col.id
                return (
                  <TableHead
                    key={col.id}
                    aria-sort={
                      active
                        ? sort.direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={cn(col.align === "right" && "text-right")}
                  >
                    <div
                      className={cn(
                        "flex",
                        col.align === "right" && "justify-end",
                      )}
                    >
                      <Button
                        type="button"
                        variant="ghost"
                        className={cn(col.align === "right" ? "-mr-2" : "-ml-2")}
                        onClick={() => {
                          setSort(toggleSort(sort, col.id))
                          setPage(1)
                        }}
                      >
                        {col.label}
                      </Button>
                    </div>
                  </TableHead>
                )
              })}
              <TableHead className="sticky right-0 z-10 w-16 bg-muted">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length + 1}
                  role="alert"
                  className="py-8 text-center whitespace-normal text-destructive"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : pageResult.rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length + 1}
                  className="py-8 text-center whitespace-normal text-muted-foreground"
                >
                  No Leads Yet.
                </TableCell>
              </TableRow>
            ) : (
              pageResult.rows.map((lead) => (
                <TableRow key={lead.id} className="group">
                  <TableCell className="font-medium">
                    {lead.leadName || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={lead.kind === "company" ? "secondary" : "outline"}
                      className="rounded-full capitalize"
                    >
                      {lead.kind}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusBadge(lead.status) as "secondary" | "destructive" | "outline"}
                      className="rounded-full capitalize"
                    >
                      {lead.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{lead.projectType || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(lead.estimatedValue)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {lead.probability}%
                  </TableCell>
                  <TableCell className="sticky right-0 z-10 w-16 bg-card group-hover:bg-muted">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${lead.leadName}`}
                          />
                        }
                      >
                        <MoreHorizontal aria-hidden="true" className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => openForm(lead)}>
                          <Pencil aria-hidden="true" />
                          Edit
                        </DropdownMenuItem>
                        {lead.status === "open" &&
                          !lead.convertedClientId &&
                          !lead.convertedProjectId ? (
                          <DropdownMenuItem
                            disabled={converting}
                            onClick={() => handleConvert(lead)}
                          >
                            <ArrowRightLeft aria-hidden="true" />
                            Convert To Client
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => askDelete(lead)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {rangeLabel(
              pageResult.rangeStart,
              pageResult.rangeEnd,
              pageResult.total,
              "lead",
              "leads",
            )}
          </p>
          <Pagination
            aria-label="Leads pagination"
            className="mx-0 w-auto justify-start sm:justify-end"
          >
            <PaginationContent className="flex-wrap">
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pageResult.currentPage <= 1}
                  aria-label="Go to previous page"
                  onClick={() => setPage(pageResult.currentPage - 1)}
                >
                  <ChevronLeft aria-hidden="true" data-icon="inline-start" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
              </PaginationItem>
              {pages.map((item, index) =>
                item === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <Button
                      type="button"
                      variant={item === pageResult.currentPage ? "outline" : "ghost"}
                      size="icon"
                      aria-label={`Page ${item}`}
                      aria-current={item === pageResult.currentPage ? "page" : undefined}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </Button>
                  </PaginationItem>
                ),
              )}
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pageResult.currentPage >= pageResult.pageCount}
                  aria-label="Go to next page"
                  onClick={() => setPage(pageResult.currentPage + 1)}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight aria-hidden="true" data-icon="inline-end" />
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      <LeadFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        lead={formLead}
        projectTypes={projectTypes}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) return
          setDeleteOpen(false)
          setDeleteError(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure to delete this item? If yes, Press and Hold
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
            <HoldToDeleteButton
              key={pendingDelete?.id}
              pending={deleting}
              onConfirm={confirmDelete}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
