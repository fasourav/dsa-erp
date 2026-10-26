"use client"

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"

import { trashSavedDocument, type TrashKind } from "@/app/(app)/documents/actions"
import { useAccess } from "@/components/access-provider"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { statusLabel } from "@/lib/documents/drafts"
import { savedToast } from "@/lib/saved"
import { cn } from "@/lib/utils"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

const columns = [
  { id: "title", label: "Title", align: "left", locked: true },
  { id: "detail", label: "Detail", align: "left", locked: true },
  { id: "documentNo", label: "Document No.", align: "left", locked: true },
  { id: "status", label: "Status", align: "left", locked: true },
] as const satisfies readonly ListColumn<string>[]

type ColumnId = (typeof columns)[number]["id"]

type DocumentListItem = {
  id: string
  title: string
  detail: string
  documentNo: string
  status?: string
}

function documentNumber(value: string) {
  return value || "Not saved for print"
}

function columnText(item: DocumentListItem, id: ColumnId) {
  if (id === "documentNo") return documentNumber(item.documentNo)
  if (id === "status") return item.status ? statusLabel(item.status) : ""
  return item[id]
}

function kindForHref(hrefBase: string): TrashKind | null {
  if (hrefBase.endsWith("/purchase-orders")) return "purchase_order"
  if (hrefBase.endsWith("/quotations")) return "quotation"
  if (hrefBase.endsWith("/work-orders")) return "work_order"
  if (hrefBase.endsWith("/invoices")) return "invoice"
  if (hrefBase.endsWith("/receipts")) return "receipt"
  if (hrefBase.endsWith("/rfqs")) return "rfq"
  return null
}

export function DocumentListView({
  items,
  hrefBase,
  empty,
  pagingLabel,
}: {
  items: DocumentListItem[]
  hrefBase: string
  empty: string
  pagingLabel: string
}) {
  const router = useRouter()
  const access = useAccess()
  const trashKind = kindForHref(hrefBase)
  const canDelete = access.isOwner && trashKind !== null
  const [sort, setSort] = useState<SortState<ColumnId>>({ key: "title", direction: "asc" })
  const [page, setPage] = useState(1)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<DocumentListItem | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  const sorted = useMemo(() => {
    const copy = [...items]
    copy.sort((left, right) => {
      const result = columnText(left, sort.key).localeCompare(columnText(right, sort.key), undefined, {
        numeric: true,
      })
      return sort.direction === "asc" ? result : -result
    })
    return copy
  }, [items, sort])
  const pageResult = paginateRows(sorted, page)
  const hasStatus = items.some((item) => item.status)
  const visibleColumns = hasStatus ? columns : columns.filter((column) => column.id !== "status")

  return (
    <>
      <DataList
        columns={visibleColumns}
        rows={pageResult.rows}
        rowKey={(item) => item.id}
        sort={sort}
        onSort={(id) => {
          setSort((current) => toggleSort(current, id))
          setPage(1)
        }}
        visibility={{}}
        error={null}
        emptyMessage={empty}
        rangeText={rangeLabel(pageResult.rangeStart, pageResult.rangeEnd, pageResult.total, "document", "documents")}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel={pagingLabel}
        mobileItem={(item) => ({
          title: <DocumentLink href={`${hrefBase}/${item.id}`}>{item.title}</DocumentLink>,
          value: item.status ? <StatusBadge status={item.status} /> : undefined,
          subtitle: item.detail,
          meta: documentNumber(item.documentNo),
        })}
        renderCell={(item, columnId) => {
          if (columnId === "title") {
            return <DocumentLink href={`${hrefBase}/${item.id}`}>{item.title}</DocumentLink>
          }
          if (columnId === "status") {
            return item.status ? <StatusBadge status={item.status} /> : null
          }
          return columnText(item, columnId)
        }}
        renderActions={(item) => {
          const label = item.documentNo || item.title || "document"
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
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  nativeButton={false}
                  render={<Link href={`${hrefBase}/${item.id}`} />}
                >
                  <Pencil aria-hidden="true" />
                  Edit
                </DropdownMenuItem>
                {canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        setPendingDelete(item)
                        setDeleteError(null)
                        setDeleteOpen(true)
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        }}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open || deleting) return
          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete Document"
        itemName={pendingDelete?.documentNo || pendingDelete?.title || "This document"}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={() => {
          if (!pendingDelete || !trashKind) return
          setDeleteError(null)
          startDelete(async () => {
            const result = await trashSavedDocument({
              kind: trashKind,
              id: pendingDelete.id,
            })
            if (result.error) {
              setDeleteError(result.error)
              return
            }
            setDeleteOpen(false)
            setPendingDelete(null)
            savedToast("Moved To Trash.")
            router.refresh()
          })
        }}
      />
    </>
  )
}

function DocumentLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-sm text-ui font-semibold text-foreground hover:text-primary-text focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      {children}
    </Link>
  )
}
