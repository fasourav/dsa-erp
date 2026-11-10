"use client"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { useCan } from "@/components/access-provider"

import { MoreHorizontal, Pencil } from "lucide-react"
import { useMemo, useState } from "react"

import { RecoveryPlanDialog } from "@/app/(app)/backlog/recovery-plan-dialog"
import { DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { RecordLink } from "@/components/record-link"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { backlogColumnStore } from "@/lib/backlog-column-store"
import {
  backlogColumns,
  sortBacklog,
  type BacklogColumnId,
  type BacklogRow,
} from "@/lib/backlog"
import {
  CLIENT_PAGE_SIZES,
  paginateRows,
  rangeLabel,
  type SortState,
} from "@/lib/list-paging"
import { useColumnVisibility } from "@/lib/use-column-visibility"
import { useListUrlState } from "@/lib/use-list-url-state"
import { cn } from "@/lib/utils"

const backlogSortKeys = backlogColumns.map((column) => column.id)
const defaultBacklogSort: SortState<BacklogColumnId> = {
  key: "backlogAmount",
  direction: "desc",
}

export function BacklogTable({
  rows,
  error,
}: {
  rows: BacklogRow[]
  error: string | null
}) {
  const canEdit = useCan("backlog", "edit")

  const visibility = useColumnVisibility(backlogColumnStore)
  const {
    query,
    setQuery,
    sort,
    onSort,
    page,
    setPage,
    pageSize,
    setPageSize,
    clearFilters,
    hasActiveFilters,
  } = useListUrlState<BacklogColumnId>({
    sortKeys: backlogSortKeys,
    defaultSort: defaultBacklogSort,
  })
  const [formOpen, setFormOpen] = useState(false)
  const [formProject, setFormProject] = useState<BacklogRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const sorted = useMemo(() => sortBacklog(rows, sort), [rows, sort])
  const filtered = useMemo(() => filterRows(sorted, query, rowText), [query, sorted])
  const pageResult = paginateRows(filtered, page, pageSize)

  function openPlan(row: BacklogRow) {
    setFormProject(row)
    setFormSession((current) => current + 1)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        title="Backlog"
        className="mb-0 md:mb-2"
        actions={
          <ListExport
            grid={{
              filename: "backlog",
              title: "Backlog",
              columns: [
                { header: "Project", kind: "text" },
                { header: "Project Value", kind: "money" },
                { header: "Amount Paid", kind: "money" },
                { header: "Total Expense", kind: "money" },
                { header: "Backlog Amount", kind: "money" },
                { header: "Status", kind: "text" },
                { header: "Recovery Plan", kind: "text" },
              ],
              rows: filtered.map((row) => [
                row.projectName,
                row.projectValue,
                row.amountPaid,
                row.totalExpense,
                row.backlogAmount,
                row.status === "active" ? "Active" : row.status === "completed" ? "Completed" : "—",
                row.recoveryPlan || "—",
              ]),
            }}
          />
        }
      />
      <ListSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Search backlog"
      />
      <DataList
        columns={backlogColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(row) => row.id}
        sort={sort}
        onSort={onSort}
        visibility={visibility}
        error={error}
        emptyMessage="No Backlog Projects Yet."
        emptyState={
          rows.length === 0 && !hasActiveFilters
            ? { kind: "none" }
            : { kind: "filtered", onClearFilters: clearFilters }
        }
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "project",
          "projects",
        )}
        totalCount={error ? 0 : pageResult.total}
        pageSize={{
          value: pageSize,
          options: CLIENT_PAGE_SIZES,
          onChange: setPageSize,
        }}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Backlog pagination"
        mobileItem={(row) => ({
          title: (
            <RecordLink
              href={`/projects/${row.id}`}
              className="block truncate underline-offset-4 hover:underline"
            >
              {row.projectName || "—"}
            </RecordLink>
          ),
          value: row.status ? <StatusBadge status={row.status} /> : undefined,
          subtitle: row.recoveryPlan || "—",
          meta: <Money value={row.backlogAmount} />,
        })}
        renderCell={(row, columnId) => <Cell row={row} columnId={columnId} />}
        renderActions={(row) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${row.projectName || "project"}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {canEdit ? (<DropdownMenuItem onClick={() => openPlan(row)}>
                <Pencil aria-hidden="true" />
                {row.recoveryPlan ? "Edit Recovery Plan" : "Add Recovery Plan"}
              </DropdownMenuItem>) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <RecoveryPlanDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        project={formProject}
      />
    </div>
  )
}

function Cell({
  row,
  columnId,
}: {
  row: BacklogRow
  columnId: BacklogColumnId
}) {
  switch (columnId) {
    case "projectName":
      return (
        <RecordLink
          href={`/projects/${row.id}`}
          className={cn(
            "block truncate rounded-sm text-ui font-semibold text-foreground underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
            !row.projectName && "text-muted-foreground",
          )}
        >
          {row.projectName || "—"}
        </RecordLink>
      )
    case "projectValue":
    case "amountPaid":
    case "totalExpense":
    case "backlogAmount":
      return <Money value={row[columnId]} />
    case "status":
      return row.status ? (
        <StatusBadge status={row.status} />
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "recoveryPlan":
      return row.recoveryPlan ? (
        <span className="line-clamp-2">{row.recoveryPlan}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
  }
}
