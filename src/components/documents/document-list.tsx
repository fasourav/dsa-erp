import Link from "next/link"

export function DocumentList({
  items,
  hrefBase,
  empty,
}: {
  items: Array<{ id: string; title: string; detail: string; documentNo: string }>
  hrefBase: string
  empty: string
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>
  }

  return (
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
  )
}
