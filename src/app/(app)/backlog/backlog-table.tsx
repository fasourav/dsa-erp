"use client"

import { MoreHorizontal, Pencil } from "lucide-react"
import { useMemo, useState } from "react"

import { RecoveryPlanDialog } from "@/app/(app)/backlog/recovery-plan-dialog"
import { DataList } from "@/components/data-list"
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
import { formatMoney } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type SortState,
} from "@/lib/list-paging"
import { useColumnVisibility } from "@/lib/use-column-visibility"

export function BacklogTable({
  rows,
  error,
}: {
  rows: BacklogRow[]
  error: string | null
}) {
  const visibility = useColumnVisibility(backlogColumnStore)
  const [sort, setSort] = useState<SortState<BacklogColumnId>>({
    key: "backlogAmount",
    direction: "desc",
  })
  const [page, setPage] = useState(1)
  const [formOpen, setFormOpen] = useState(false)
  const [formProject, setFormProject] = useState<BacklogRow | null>(null)
  const [formSession, setFormSession] = useState(0)
  const sorted = useMemo(() => sortBacklog(rows, sort), [rows, sort])
  const pageResult = paginateRows(sorted, page)

  function openPlan(row: BacklogRow) {
    setFormProject(row)
    setFormSession((current) => current + 1)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">Backlog</h1>
      <DataList
        columns={backlogColumns}
        rows={error ? [] : pageResult.rows}
        rowKey={(row) => row.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
          setPage(1)
        }}
        visibility={visibility}
        error={error}
        emptyMessage="No Backlog Projects Yet."
        rangeText={rangeLabel(
          pageResult.rangeStart,
          pageResult.rangeEnd,
          error ? 0 : pageResult.total,
          "project",
          "projects",
        )}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Backlog pagination"
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
              <DropdownMenuItem onClick={() => openPlan(row)}>
                <Pencil aria-hidden="true" />
                {row.recoveryPlan ? "Edit Recovery Plan" : "Add Recovery Plan"}
              </DropdownMenuItem>
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
      return row.projectName ? (
        <span className="font-medium">{row.projectName}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    case "projectValue":
    case "amountPaid":
    case "totalExpense":
    case "backlogAmount":
      return <span className="tabular-nums">{formatMoney(row[columnId])}</span>
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
