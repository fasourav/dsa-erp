"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useAccess, useCan } from "@/components/access-provider"

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
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
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
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

export function ClientsTable({
  clients,
  error,
  initialQuery = "",
}: {
  clients: ClientSummary[]
  error: string | null
  initialQuery?: string
}) {
  const canAdd = useCan("clients", "add")
  const showFinancials = useAccess().showFinancials

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
  const [query, setQuery] = useState(initialQuery)
  const [listFilter, setListFilter] = useState("all")
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
  const filterOptions = [
    { value: "all", label: "All Types" },
    { value: "person", label: "Person" },
    { value: "company", label: "Company" },
  ]
  const filtered = useMemo(
    () => filterRows(sorted, query, rowText, listFilter, (client) => client.kind ?? ""),
    [listFilter, query, sorted],
  )
  const pageResult = useMemo(
    () => paginateClients(filtered, page),
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
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Clients"
        className="mb-0 md:mb-2"
        actions={
        <>
          <ListExport
            grid={{
              filename: "clients",
              title: "Clients",
              columns: [
                { header: "Name", kind: "text" },
                { header: "Type", kind: "text" },
                { header: "Ongoing Projects", kind: "integer" },
                { header: "Completed Projects", kind: "integer" },
                { header: "Total Projects", kind: "integer" },
                { header: "Total Project Value", kind: "money" },
                { header: "Total Paid", kind: "money" },
                { header: "Total Pending", kind: "money" },
                { header: "Gross Profit", kind: "money" },
                { header: "Gross Profit %", kind: "text" },
              ],
              rows: filtered.map((client) => [
                client.displayName,
                kindLabel(client.kind) || "—",
                client.ongoingProjects,
                client.completedProjects,
                client.totalProjects,
                client.totalProjectValue,
                showFinancials ? client.totalPaid : "Hidden",
                showFinancials ? client.totalPending : "Hidden",
                showFinancials ? client.grossProfit : "Hidden",
                !showFinancials
                  ? "Hidden"
                  : client.grossProfitPct == null
                    ? "—"
                    : `${client.grossProfitPct.toFixed(1)}%`,
              ]),
            }}
          />
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
          {canAdd ? (
          <Button type="button" onClick={() => openForm(null)}>
            <Plus aria-hidden="true" data-icon="inline-start" />
            Add New Client
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
        placeholder="Search clients"
        filterLabel="Type"
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
        mobileItem={(client) => ({
          title: client.displayName || "—",
          subtitle: [
            kindLabel(client.kind),
            `${formatCount(client.totalProjects)} ${client.totalProjects === 1 ? "Project" : "Projects"}`,
          ]
            .filter(Boolean)
            .join(" · "),
          meta: <Money value={client.totalProjectValue} />,
        })}
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

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete Client"
        itemName={pendingDelete?.displayName}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
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
  const showFinancials = useAccess().showFinancials
  if (
    !showFinancials &&
    (columnId === "totalPaid" ||
      columnId === "totalPending" ||
      columnId === "grossProfit" ||
      columnId === "grossProfitPct")
  ) {
    return <span className="text-muted-foreground">Hidden</span>
  }

  switch (columnId) {
    case "displayName":
      return (
        <Button
          type="button"
          variant="link"
          className={cn(
            "h-auto min-h-8 px-0 text-ui font-semibold text-foreground",
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

      return <Badge variant="outline">{kindLabel(client.kind)}</Badge>
    case "ongoingProjects":
    case "completedProjects":
    case "totalProjects":
      return <span className="tabular-nums">{formatCount(client[columnId])}</span>
    case "totalProjectValue":
    case "grossProfit":
      return <Money value={client[columnId]} />
    case "totalPaid":
      return (
        <Money
          value={client.totalPaid}
          className={client.totalPaid > 0 ? "text-success" : "text-muted-foreground"}
        />
      )
    case "totalPending":
      return (
        <Money
          value={client.totalPending}
          className={client.totalPending > 0 ? "text-destructive" : "text-muted-foreground"}
        />
      )
    case "grossProfitPct": {
      const pct = client.grossProfitPct
      if (pct == null) {
        return <span className="text-muted-foreground">—</span>
      }
      return (
        <Badge variant={pct >= 0 ? "success" : "destructive"}>{`${pct.toFixed(1)}%`}</Badge>
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
  const canEdit = useCan("clients", "edit")
  const canDelete = useCan("clients", "delete")
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
        {canEdit ? (<DropdownMenuItem onClick={() => onEdit(client)}>
          <Pencil aria-hidden="true" />
          Edit
        </DropdownMenuItem>) : null}
        <DropdownMenuSeparator />
        {canDelete ? (<DropdownMenuItem variant="destructive" onClick={() => onDelete(client)}>
          <Trash2 aria-hidden="true" />
          Delete
        </DropdownMenuItem>) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


