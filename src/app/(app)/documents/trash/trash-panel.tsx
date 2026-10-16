"use client"

import { MoreHorizontal, RotateCcw, Trash2 } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  deleteSavedDocumentForever,
  restoreSavedDocument,
  type TrashKind,
} from "@/app/(app)/documents/actions"
import { DataList } from "@/components/data-list"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { TrashedDocument } from "@/lib/documents/queries"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import { savedToast } from "@/lib/saved"

const columns = [
  { id: "kind", label: "Kind", align: "left", locked: true },
  { id: "documentNo", label: "Document No.", align: "left", locked: true },
  { id: "detail", label: "Date", align: "left", locked: true },
] as const satisfies readonly ListColumn<string>[]

type ColumnId = (typeof columns)[number]["id"]

function columnText(item: TrashedDocument, id: ColumnId) {
  if (id === "kind") return item.kindLabel
  return item[id]
}

export function TrashPanel({ items }: { items: TrashedDocument[] }) {
  const router = useRouter()
  const [sort, setSort] = useState<SortState<ColumnId>>({ key: "detail", direction: "desc" })
  const [page, setPage] = useState(1)
  const [pending, startTransition] = useTransition()
  const [target, setTarget] = useState<TrashedDocument | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  function restore(item: TrashedDocument) {
    startTransition(async () => {
      const result = await restoreSavedDocument({ kind: item.kind as TrashKind, id: item.id })
      if (result.error) {
        toast.error(result.error)
        return
      }
      savedToast("Restored.")
      router.refresh()
    })
  }

  return (
    <>
      <DataList
        columns={columns}
        rows={pageResult.rows}
        rowKey={(item) => `${item.kind}:${item.id}`}
        sort={sort}
        onSort={(id) => {
          setSort((current) => toggleSort(current, id))
          setPage(1)
        }}
        visibility={{}}
        error={null}
        emptyMessage="Trash Is Empty."
        rangeText={rangeLabel(pageResult.rangeStart, pageResult.rangeEnd, pageResult.total, "document", "documents")}
        currentPage={pageResult.currentPage}
        pageCount={pageResult.pageCount}
        onPageChange={setPage}
        pagingLabel="Trash pagination"
        mobileItem={(item) => ({
          title: item.kindLabel,
          subtitle: item.detail,
          meta: item.documentNo || "—",
        })}
        renderCell={(item, columnId) => columnText(item, columnId)}
        renderActions={(item) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={pending}
                  aria-label={`Actions for ${item.documentNo || item.kindLabel}`}
                />
              }
            >
              <MoreHorizontal aria-hidden="true" className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem disabled={pending} onClick={() => restore(item)}>
                <RotateCcw aria-hidden="true" />
                Restore
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={pending}
                onClick={() => {
                  setError(null)
                  setTarget(item)
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete Forever
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
      <DeleteConfirmDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!pending && !open) setTarget(null)
        }}
        title="Delete Forever"
        itemName={target?.documentNo || target?.kindLabel}
        error={error}
        pending={pending}
        confirmKey={target ? `${target.kind}:${target.id}` : undefined}
        onConfirm={() => {
          if (!target) return
          const current = target
          setError(null)
          startTransition(async () => {
            const result = await deleteSavedDocumentForever({
              kind: current.kind as TrashKind,
              id: current.id,
            })
            if (result.error) {
              setError(result.error)
              return
            }
            setTarget(null)
            savedToast("Deleted.")
            router.refresh()
          })
        }}
      />
    </>
  )
}
