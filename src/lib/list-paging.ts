export const LIST_PAGE_SIZE = 10

export type SortDirection = "asc" | "desc"

export type SortState<Id extends string> = {
  key: Id
  direction: SortDirection
}

export type ListColumn<Id extends string> = {
  id: Id
  label: string
  align: "left" | "right" | "center"
  locked: boolean
}

export function toggleSort<Id extends string>(
  current: SortState<Id>,
  key: Id,
): SortState<Id> {
  if (current.key !== key) {
    return { key, direction: "asc" }
  }

  return {
    key,
    direction: current.direction === "asc" ? "desc" : "asc",
  }
}

export function paginateRows<T>(rows: readonly T[], page: number) {
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const startIndex = (currentPage - 1) * LIST_PAGE_SIZE

  return {
    rows: rows.slice(startIndex, startIndex + LIST_PAGE_SIZE),
    total,
    pageCount,
    currentPage,
    rangeStart: total === 0 ? 0 : startIndex + 1,
    rangeEnd: Math.min(startIndex + LIST_PAGE_SIZE, total),
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

export function rangeLabel(
  start: number,
  end: number,
  total: number,
  singular: string,
  plural: string,
): string {
  if (total === 0) {
    return `0 ${plural}`
  }

  const noun = total === 1 ? singular : plural

  if (start === end) {
    return `Showing ${start} of ${total} ${noun}`
  }

  return `Showing ${start}–${end} of ${total} ${noun}`
}

export function sanitizeColumnVisibility<Id extends string>(
  optionalIds: readonly Id[],
  defaults: Record<Id, boolean>,
  value: unknown,
): Record<Id, boolean> {
  const visibility = { ...defaults }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return visibility
  }

  const record = value as Record<string, unknown>

  for (const id of optionalIds) {
    const stored = record[id]
    if (typeof stored === "boolean") {
      visibility[id] = stored
    }
  }

  return visibility
}

export function columnVisible<Id extends string>(
  column: ListColumn<Id>,
  visibility: Partial<Record<Id, boolean>>,
): boolean {
  if (column.locked) {
    return true
  }

  return visibility[column.id] !== false
}
