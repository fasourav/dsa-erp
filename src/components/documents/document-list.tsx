import Link from "next/link"

import { ListExport } from "@/components/list-export"

export function DocumentList({
  items,
  hrefBase,
  empty,
  exportName,
  exportTitle,
}: {
  items: Array<{ id: string; title: string; detail: string; documentNo: string }>
  hrefBase: string
  empty: string
  exportName: string
  exportTitle: string
}) {
  const exportGrid = {
    filename: exportName,
    title: exportTitle,
    columns: [
      { header: "Title", kind: "text" as const },
      { header: "Detail", kind: "text" as const },
      { header: "Document No.", kind: "text" as const },
    ],
    rows: items.map((item) => [
      item.title,
      item.detail,
      item.documentNo || "Not saved for print",
    ]),
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <ListExport grid={exportGrid} />
        <p className="text-sm text-muted-foreground">{empty}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
    <ListExport grid={exportGrid} />
    <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={`${hrefBase}/${item.id}`}
            className="flex flex-col gap-1 px-4 py-3 hover:bg-accent"
          >
            <span className="font-medium">{item.title}</span>
            <span className="text-sm text-muted-foreground">{item.detail}</span>
            <span className="text-sm text-muted-foreground">
              {item.documentNo || "Not saved for print"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
    </div>
  )
}
