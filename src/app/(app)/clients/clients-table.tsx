"use client"

import {
  ChevronDown,
  Columns3,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useMemo, useState, useSyncExternalStore, useTransition } from "react"

import { deleteClient } from "@/app/(app)/clients/actions"
import { ClientContactDialog } from "@/app/(app)/clients/client-contact-dialog"
import { ClientFormDialog } from "@/app/(app)/clients/client-form-dialog"
import { HoldToDeleteButton } from "@/app/(app)/clients/hold-to-delete-button"
import { DataList } from "@/components/data-list"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
  writeColumnVisibility,
} from "@/lib/client-column-store"
import {
  clientRangeLabel,
  dataColumns,
  isOptionalColumn,
  kindLabel,
  paginateClients,
  sortClients,
  type ClientSummary,
  type ColumnId,
  type SortState,
} from "@/lib/client-summary"
import { formatCount, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

export function ClientsTable({
  clients,
  error,
}: {
  clients: ClientSummary[]
  error: string | null
}) {
  const visibility = useSyncExternalStore(
    subscribeColumnVisibility,
    getColumnSnapshot,
    getColumnServerSnapshot,
  )
  const [sort, setSort] = useState<SortState>({
    key: "displayName",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formClient, setFormClient] = useState<ClientSummary | null>(null)
  const [formSession, setFormSession] = useState(0)
  const [contactOpen, setContactOpen] = useState(false)
  const [contactClient, setContactClient] = useState<ClientSummary | null>(
    null,
  )
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ClientSummary | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(() => sortClients(clients, sort), [clients, sort])
  const pageResult = useMemo(
    () => paginateClients(sorted, page),
    [sorted, page],
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

  function openForm(client: ClientSummary | null) {
    setFormClient(client)
    setFormSession((current) => current + 1)
    setFormOpen(true)
  }

  function openContact(client: ClientSummary) {
    setContactClient(client)
    setContactOpen(true)
  }

  function askDelete(client: ClientSummary) {
    setDeleteError(null)
    setPendingDelete(client)
    setDeleteOpen(true)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteClient(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this client.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-medium tracking-tight">Clients</h1>
        <div className="flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button type="button" variant="outline" />}
            >
              <Columns3 aria-hidden="true" data-icon="inline-start" />
              Customize Columns
              <ChevronDown aria-hidden="true" data-icon="inline-end" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {dataColumns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={
                    isOptionalColumn(column.id) ? visibility[column.id] : true
                  }
                  disabled={column.locked}
                  onCheckedChange={(checked) => {
                    if (!isOptionalColumn(column.id)) {
                      return
                    }

                    writeColumnVisibility({
                      ...visibility,
                      [column.id]: checked,
                    })
                  }}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" onClick={() => openForm(null)}>
            <Plus aria-hidden="true" data-icon="inline-start" />
            Add New Client
          </Button>
        </div>
      </div>

      <DataList
        columns={dataColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(client) => client.id}
        sort={sort}
        onSort={toggleSort}
        visibility={visibility}
        error={error}
        emptyMessage="No Clients Yet."
        rangeText={clientRangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Clients pagination"
        renderCell={(client, columnId) => (
          <CellValue
            client={client}
            columnId={columnId}
            onOpenContact={openContact}
          />
        )}
        renderActions={(client) => (
          <RowActions
            client={client}
            onEdit={openForm}
            onDelete={askDelete}
          />
        )}
      />

      <ClientFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        client={formClient}
      />

      <ClientContactDialog
        client={contactClient}
        open={contactOpen}
        onOpenChange={setContactOpen}
      />

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
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

function CellValue({
  client,
  columnId,
  onOpenContact,
}: {
  client: ClientSummary
  columnId: ColumnId
  onOpenContact: (client: ClientSummary) => void
}) {
  switch (columnId) {
    case "displayName":
      return (
        <Button
          type="button"
          variant="link"
          className={cn(
            "h-auto min-h-8 px-0 font-medium text-foreground",
            !client.displayName && "text-muted-foreground",
          )}
          aria-label={`Open contact card for ${client.displayName || "client"}`}
          onClick={() => onOpenContact(client)}
        >
          {client.displayName || "—"}
        </Button>
      )
    case "kind":
      if (!client.kind) {
        return <span className="text-muted-foreground">—</span>
      }

      return (
        <Badge
          variant={client.kind === "company" ? "secondary" : "outline"}
          className="rounded-full"
        >
          {kindLabel(client.kind)}
        </Badge>
      )
    case "ongoingProjects":
    case "completedProjects":
    case "totalProjects":
      return <span className="tabular-nums">{formatCount(client[columnId])}</span>
    case "totalProjectValue":
    case "totalPaid":
    case "totalPending":
    case "grossProfit":
      return <span className="tabular-nums">{formatMoney(client[columnId])}</span>
    case "grossProfitPct": {
      const pct = client.grossProfitPct
      if (pct == null) {
        return <span className="text-muted-foreground">—</span>
      }
      const positive = pct >= 0
      return (
        <Badge
          variant="outline"
          className={
            positive
              ? "rounded-full border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
              : "rounded-full border-destructive/40 text-destructive"
          }
        >
          {`${pct.toFixed(1)}%`}
        </Badge>
      )
    }
  }
}

function RowActions({
  client,
  onEdit,
  onDelete,
}: {
  client: ClientSummary
  onEdit: (client: ClientSummary) => void
  onDelete: (client: ClientSummary) => void
}) {
  const label = client.displayName || "client"

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
        <DropdownMenuItem onClick={() => onEdit(client)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(client)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


