"use client"

import Link from "next/link"
import { useMemo, useState } from "react"

import { DataList } from "@/components/data-list"
import { StatusBadge } from "@/components/status-badge"
import { statusLabel } from "@/lib/documents/drafts"
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
  const [sort, setSort] = useState<SortState<ColumnId>>({ key: "title", direction: "asc" })
  const [page, setPage] = useState(1)
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
    />
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
