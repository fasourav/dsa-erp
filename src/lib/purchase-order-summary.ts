export const PAGE_SIZE = 10

export const COLUMN_STORAGE_KEY = "dsa-erp.purchase-orders.columns"

export type ProjectOption = {
  id: string
  name: string
}

export type VendorOption = {
  id: string
  displayName: string
}

export type PurchaseOrderRow = {
  id: string
  issuedOn: string
  projectId: string | null
  projectName: string
  vendorId: string
  vendorName: string
  workType: string
  totalValue: number
  totalPaid: number
  totalPending: number
  notes: string
}

export type ColumnId =
  | "issuedOn"
  | "projectName"
  | "vendorName"
  | "totalValue"
  | "totalPaid"
  | "totalPending"

export type OptionalColumnId = Exclude<
  ColumnId,
  "issuedOn" | "projectName" | "vendorName"
>

export type ColumnVisibility = Record<OptionalColumnId, boolean>

export type SortDirection = "asc" | "desc"

export type SortState = {
  key: ColumnId
  direction: SortDirection
}

export type DataColumn = {
  id: ColumnId
  label: string
  align: "left" | "right"
  locked: boolean
}

export const dataColumns: readonly DataColumn[] = [
  { id: "issuedOn", label: "Date", align: "left", locked: true },
  { id: "projectName", label: "Project Name", align: "left", locked: true },
  { id: "vendorName", label: "Vendor Name", align: "left", locked: true },
  {
    id: "totalValue",
    label: "Purchase Order Value",
    align: "right",
    locked: false,
  },
  { id: "totalPaid", label: "Total Paid", align: "right", locked: false },
  { id: "totalPending", label: "Pending Due", align: "right", locked: false },
]

const defaultVisibility: ColumnVisibility = {
  totalValue: true,
  totalPaid: true,
  totalPending: true,
}

const purchaseOrderDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

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
  return id !== "issuedOn" && id !== "projectName" && id !== "vendorName"
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

export function formatPurchaseOrderDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return value || "—"
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return value
  }

  return purchaseOrderDateFormatter.format(date)
}

export function sortPurchaseOrders(
  orders: readonly PurchaseOrderRow[],
  sort: SortState,
): PurchaseOrderRow[] {
  const direction = sort.direction === "asc" ? 1 : -1

  return [...orders].sort((a, b) => {
    const primary = comparePurchaseOrders(a, b, sort.key) * direction
    if (primary !== 0) {
      return primary
    }

    const byDate = b.issuedOn.localeCompare(a.issuedOn)
    if (byDate !== 0) {
      return byDate
    }

    return a.id.localeCompare(b.id)
  })
}

function comparePurchaseOrders(
  a: PurchaseOrderRow,
  b: PurchaseOrderRow,
  key: ColumnId,
): number {
  switch (key) {
    case "issuedOn":
      return a.issuedOn.localeCompare(b.issuedOn)
    case "projectName":
      return a.projectName.localeCompare(b.projectName, "en", {
        sensitivity: "base",
      })
    case "vendorName":
      return vendorSortKey(a).localeCompare(vendorSortKey(b), "en", {
        sensitivity: "base",
      })
    case "totalValue":
    case "totalPaid":
    case "totalPending":
      return a[key] - b[key]
  }
}

function vendorSortKey(order: PurchaseOrderRow): string {
  return `${order.vendorName}\n${order.workType}`
}

export function paginatePurchaseOrders(
  orders: readonly PurchaseOrderRow[],
  page: number,
) {
  const total = orders.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const startIndex = (currentPage - 1) * PAGE_SIZE

  return {
    rows: orders.slice(startIndex, startIndex + PAGE_SIZE),
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

export function purchaseOrderRangeLabel(
  start: number,
  end: number,
  total: number,
): string {
  if (total === 0) {
    return "0 purchase orders"
  }

  const noun = total === 1 ? "purchase order" : "purchase orders"

  if (start === end) {
    return `Showing ${start} of ${total} ${noun}`
  }

  return `Showing ${start}–${end} of ${total} ${noun}`
}
