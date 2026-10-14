import { DocumentListView } from "@/components/documents/document-list-view"
import type { ListExportGrid } from "@/lib/reports/workbook"

export type DocumentListItem = {
  id: string
  title: string
  detail: string
  documentNo: string
}

export function documentExportGrid(
  items: readonly DocumentListItem[],
  filename: string,
  title: string,
): ListExportGrid {
  return {
    filename,
    title,
    columns: [
      { header: "Title", kind: "text" },
      { header: "Detail", kind: "text" },
      { header: "Document No.", kind: "text" },
    ],
    rows: items.map((item) => [
      item.title,
      item.detail,
      item.documentNo || "Not saved for print",
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
