import Link from "next/link"

import { ListExport } from "@/components/list-export"
import { StatusBadge } from "@/components/status-badge"
import { statusLabel } from "@/lib/documents/drafts"

export function DocumentList({
  items,
  hrefBase,
  empty,
  exportName,
  exportTitle,
}: {
  items: Array<{ id: string; title: string; detail: string; documentNo: string; status?: string }>
  hrefBase: string
  empty: string
  exportName: string
  exportTitle: string
}) {
  const hasStatus = items.some((item) => item.status)
  const exportGrid = {
    filename: exportName,
    title: exportTitle,
    columns: [
      { header: "Title", kind: "text" as const },
      { header: "Detail", kind: "text" as const },
      { header: "Document No.", kind: "text" as const },
      ...(hasStatus ? [{ header: "Status", kind: "text" as const }] : []),
    ],
    rows: items.map((item) => [
      item.title,
      item.detail,
      item.documentNo || "Not saved for print",
      ...(hasStatus ? [item.status ? statusLabel(item.status) : ""] : []),
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
            <span className="flex min-w-0 items-start justify-between gap-3">
              <span className="min-w-0 font-medium break-words">{item.title}</span>
              {item.status ? <StatusBadge status={item.status} /> : null}
            </span>
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
