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
  sortable?: boolean
  width?: string
  minWidth?: number
}

export type TableColumnLayout = {
  columnWidths: string[]
  actionsWidthPx: number
  minWidthPx: number
}

export function computeTableColumnLayout<Id extends string>(
  columns: readonly ListColumn<Id>[],
  options: { dense: boolean; hasActions: boolean },
): TableColumnLayout {
  const { dense, hasActions } = options
  const actionsWidthPx = hasActions ? (dense ? 52 : 80) : 0

  if (columns.length === 0) {
    return {
      columnWidths: [],
      actionsWidthPx,
      minWidthPx: actionsWidthPx,
    }
  }

  const specs = columns.map((column, index) => {
    const previous = columns[index - 1]?.align ?? null
    const next = columns[index + 1]?.align ?? null
    const padPx = dense
      ? index === 0
        ? 20
        : 12
      : 24 +
        (index === 0 ? 12 : 0) +
        (!hasActions && index === columns.length - 1 ? 8 : 0) +
        (column.align === "right" && next !== null && next !== "right" ? 12 : 0) +
        (previous === "right" && column.align !== "right" ? 12 : 0)
    const labelFloor =
      Math.ceil(column.label.length * (dense ? 6.2 : 6.6)) +
      (column.sortable !== false ? 16 : 0) +
      padPx

    const { weight, minPx } = defaultColumnRole(column, index, dense)
    const resolvedMin = column.minWidth ?? Math.max(minPx, labelFloor)
    const resolvedWeight = Math.max(weight, resolvedMin / 110)

    return {
      explicitWidth: column.width,
      minPx: resolvedMin,
      weight: column.width ? 0 : resolvedWeight,
    }
  })

  const totalWeight = specs.reduce((sum, spec) => sum + spec.weight, 0)
  const columnWidths = specs.map((spec) => {
    if (spec.explicitWidth) {
      return spec.explicitWidth
    }
    if (totalWeight <= 0) {
      return `${(100 / columns.length).toFixed(2)}%`
    }
    return `${((spec.weight / totalWeight) * 100).toFixed(2)}%`
  })

  const minWidthPx =
    specs.reduce((sum, spec) => sum + spec.minPx, 0) + actionsWidthPx

  return {
    columnWidths,
    actionsWidthPx,
    minWidthPx,
  }
}

function defaultColumnRole<Id extends string>(
  column: ListColumn<Id>,
  index: number,
  dense: boolean,
): { weight: number; minPx: number } {
  const id = column.id
  const isDate =
    /date/i.test(id) ||
    /date/i.test(column.label) ||
    /(?:On|At)$/.test(id) ||
    id === "when"

  if (isDate) {
    return { weight: 1.15, minPx: dense ? 96 : 112 }
  }

  if (column.align === "center") {
    return { weight: 1.05, minPx: dense ? 88 : 104 }
  }

  if (column.align === "right") {
    if (/pct|percent|probability|rate|qty|quantity|count/i.test(id)) {
      return { weight: 1.05, minPx: dense ? 92 : 108 }
    }
    return { weight: 1.3, minPx: dense ? 104 : 120 }
  }

  if (
    /^(kind|status|stage|currentStage|phase|currency|direction|isActive|role|code|documentNo|number)$/i.test(
      id,
    )
  ) {
    return { weight: 1.1, minPx: dense ? 92 : 108 }
  }

  if (
    /category|vendorField|source|sourceKind|paymentMethod|progress|department|designation|workType|who|action/i.test(
      id,
    )
  ) {
    return { weight: 1.35, minPx: dense ? 108 : 124 }
  }

  if (index === 0) {
    return { weight: 2.1, minPx: dense ? 152 : 180 }
  }

  return { weight: 1.75, minPx: dense ? 132 : 156 }
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

export function paginateRows<T>(
  rows: readonly T[],
  page: number,
  pageSize: number = LIST_PAGE_SIZE,
) {
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const startIndex = (currentPage - 1) * pageSize

  return {
    rows: rows.slice(startIndex, startIndex + pageSize),
    total,
    pageCount,
    currentPage,
    rangeStart: total === 0 ? 0 : startIndex + 1,
    rangeEnd: Math.min(startIndex + pageSize, total),
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
