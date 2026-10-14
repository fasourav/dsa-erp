import { DocumentListView } from "@/components/documents/document-list-view"
import { statusLabel } from "@/lib/documents/drafts"
import type { ListExportGrid } from "@/lib/reports/workbook"

export type DocumentListItem = {
  id: string
  title: string
  detail: string
  documentNo: string
  status?: string
}

export function documentExportGrid(
  items: readonly DocumentListItem[],
  filename: string,
  title: string,
): ListExportGrid {
  const hasStatus = items.some((item) => item.status)
  return {
    filename,
    title,
    columns: [
      { header: "Title", kind: "text" },
      { header: "Detail", kind: "text" },
      { header: "Document No.", kind: "text" },
      ...(hasStatus ? [{ header: "Status", kind: "text" as const }] : []),
    ],
    rows: items.map((item) => [
      item.title,
      item.detail,
      item.documentNo || "Not saved for print",
      ...(hasStatus ? [item.status ? statusLabel(item.status) : ""] : []),
    ]),
  }
}

export function DocumentList({
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
  return (
    <DocumentListView
      items={items}
      hrefBase={hrefBase}
      empty={empty}
      pagingLabel={pagingLabel}
    />
  )
}
