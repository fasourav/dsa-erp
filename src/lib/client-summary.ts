export const PAGE_SIZE = 10

export const COLUMN_STORAGE_KEY = "dsa-erp.clients.columns"

export type ClientKind = "person" | "company"

export type ClientSummary = {
  id: string
  displayName: string
  kind: ClientKind | null
  ongoingProjects: number
  completedProjects: number
  totalProjects: number
  totalProjectValue: number
  totalPaid: number
  totalPending: number
  grossProfit: number
  grossProfitPct: number | null
  personName: string | null
  companyName: string | null
  email: string | null
  phone: string | null
  notes: string | null
  address: string | null
}

export type ColumnId =
  | "displayName"
  | "kind"
  | "ongoingProjects"
  | "completedProjects"
  | "totalProjects"
  | "totalProjectValue"
  | "totalPaid"
  | "totalPending"
  | "grossProfit"
  | "grossProfitPct"

export type OptionalColumnId = Exclude<ColumnId, "displayName" | "kind">

export type ColumnVisibility = Record<OptionalColumnId, boolean>

export type SortDirection = "asc" | "desc"

export type SortState = {
  key: ColumnId
  direction: SortDirection
}

type ColumnFormat = "text" | "kind" | "count" | "money" | "percentPill"

export type DataColumn = {
  id: ColumnId
  label: string
  align: "left" | "right" | "center"
  locked: boolean
  format: ColumnFormat
}

export const dataColumns: readonly DataColumn[] = [
  {
    id: "displayName",
    label: "Name",
    align: "left",
    locked: true,
    format: "text",
  },
  { id: "kind", label: "Type", align: "left", locked: true, format: "kind" },
  {
    id: "ongoingProjects",
    label: "Ongoing Projects",
    align: "center",
    locked: false,
    format: "count",
  },
  {
    id: "completedProjects",
    label: "Completed Projects",
    align: "center",
    locked: false,
    format: "count",
  },
  {
    id: "totalProjects",
    label: "Total Projects",
    align: "center",
    locked: false,
    format: "count",
  },
  {
    id: "totalProjectValue",
    label: "Total Project Value",
    align: "right",
    locked: false,
    format: "money",
  },
  {
    id: "totalPaid",
    label: "Total Paid",
    align: "right",
    locked: false,
    format: "money",
  },
  {
    id: "totalPending",
    label: "Total Pending",
    align: "right",
    locked: false,
    format: "money",
  },
]

const defaultVisibility: ColumnVisibility = {
  ongoingProjects: true,
  completedProjects: true,
  totalProjects: false,
  totalProjectValue: true,
  totalPaid: true,
  totalPending: true,
  grossProfit: true,
  grossProfitPct: true,
}

export function defaultColumnVisibility(): ColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizeColumnVisibility(value: unknown): ColumnVisibility {
  const visibility = defaultColumnVisibility()

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return visibility
  }

  const record = value as Record<string, unknown>

  for (const column of dataColumns) {
    if (!isOptionalColumn(column.id)) {
      continue
    }

    const stored = record[column.id]
    if (typeof stored === "boolean") {
      visibility[column.id] = stored
    }
  }

  return visibility
}

export function isOptionalColumn(id: ColumnId): id is OptionalColumnId {
  return id !== "displayName" && id !== "kind"
}

export function isColumnVisible(
  id: ColumnId,
  visibility: ColumnVisibility,
): boolean {
  if (!isOptionalColumn(id)) {
    return true
  }

  return visibility[id]
}

export function kindLabel(kind: ClientKind | null): string {
  if (kind === "person") {
    return "Person"
  }

  if (kind === "company") {
    return "Company"
  }

  return ""
}

export function sortClients(
  clients: readonly ClientSummary[],
  sort: SortState,
): ClientSummary[] {
  const direction = sort.direction === "asc" ? 1 : -1

  return [...clients].sort((a, b) => {
    const primary = compareClients(a, b, sort.key) * direction
    if (primary !== 0) {
      return primary
    }

    const byName = a.displayName.localeCompare(b.displayName, "en", {
      sensitivity: "base",
    })
    if (byName !== 0) {
      return byName
    }

    return a.id.localeCompare(b.id)
  })
}

function compareClients(
  a: ClientSummary,
  b: ClientSummary,
  key: ColumnId,
): number {
  switch (key) {
    case "displayName":
      return a.displayName.localeCompare(b.displayName, "en", {
        sensitivity: "base",
      })
    case "kind":
      return kindLabel(a.kind).localeCompare(kindLabel(b.kind), "en", {
        sensitivity: "base",
      })
    case "ongoingProjects":
    case "completedProjects":
    case "totalProjects":
    case "totalProjectValue":
    case "totalPaid":
    case "totalPending":
    case "grossProfit":
      return a[key] - b[key]
    case "grossProfitPct":
      return (a.grossProfitPct ?? Number.NEGATIVE_INFINITY) - (b.grossProfitPct ?? Number.NEGATIVE_INFINITY)
  }
}

export function paginateClients(
  clients: readonly ClientSummary[],
  page: number,
) {
  const total = clients.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const startIndex = (currentPage - 1) * PAGE_SIZE

  return {
    rows: clients.slice(startIndex, startIndex + PAGE_SIZE),
    total,
    pageCount,
    currentPage,
    rangeStart: total === 0 ? 0 : startIndex + 1,
    rangeEnd: Math.min(startIndex + PAGE_SIZE, total),
  }
}

export function paginationItems(
  currentPage: number,
  pageCount: number,
): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const pages = [1, pageCount, currentPage - 1, currentPage, currentPage + 1]
    .filter(
      (page, index, all) =>
        page >= 1 && page <= pageCount && all.indexOf(page) === index,
    )
    .sort((left, right) => left - right)

  const items: Array<number | "ellipsis"> = []

  for (const page of pages) {
    const previous = items.at(-1)
    if (typeof previous === "number" && page - previous > 1) {
      items.push("ellipsis")
    }
    items.push(page)
  }

  return items
}

export function clientRangeLabel(
  start: number,
  end: number,
  total: number,
): string {
  if (total === 0) {
    return "0 clients"
  }

  const noun = total === 1 ? "client" : "clients"

  if (start === end) {
    return `Showing ${start} of ${total} ${noun}`
  }

  return `Showing ${start}–${end} of ${total} ${noun}`
}
