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
  columnMinWidthsPx: number[]
  columnWidths: string[]
  actionsWidthPx: number
  minWidthPx: number
}

export function computeTableColumnLayout<Id extends string>(
  columns: readonly ListColumn<Id>[],
  options: { dense: boolean; hasActions: boolean },
): TableColumnLayout {
  const { dense, hasActions } = options
  const compactActions = dense || columns.length >= 6
  const actionsWidthPx = hasActions ? (compactActions ? 56 : 76) : 0

  if (columns.length === 0) {
    return {
      columnMinWidthsPx: [],
      columnWidths: [],
      actionsWidthPx,
      minWidthPx: actionsWidthPx,
    }
  }

  const specs = columns.map((column, index) => {
    const previous = columns[index - 1]?.align ?? null
    const next = columns[index + 1]?.align ?? null
    const padPx = dense
      ? 20 +
        (index === 0 ? 10 : 0) +
        (!hasActions && index === columns.length - 1 ? 10 : 0) +
        (column.align === "right" && next !== null && next !== "right" ? 6 : 0) +
        (previous === "right" && column.align !== "right" ? 6 : 0)
      : 24 +
        (index === 0 ? 12 : 0) +
        (!hasActions && index === columns.length - 1 ? 8 : 0) +
        (column.align === "right" && next !== null && next !== "right" ? 12 : 0) +
        (previous === "right" && column.align !== "right" ? 12 : 0)

    const labelFloor =
      Math.ceil(column.label.length * 7.2) +
      (column.sortable !== false ? 18 : 0) +
      padPx

    const explicitPx = parseExplicitPx(column.width)
    const purposePx = defaultColumnWidthPx(column, index, dense)
    const minPx =
      column.minWidth ??
      (explicitPx !== null ? Math.ceil(explicitPx) : Math.max(purposePx, labelFloor))

    return {
      explicitWidth: column.width,
      minPx,
      flexPx: column.width ? 0 : minPx,
    }
  })

  const totalFlexPx = specs.reduce((sum, spec) => sum + spec.flexPx, 0)
  const columnWidths = specs.map((spec) => {
    if (spec.explicitWidth) {
      return spec.explicitWidth
    }
    if (totalFlexPx <= 0) {
      return `${(100 / columns.length).toFixed(4)}%`
    }
    return `${((spec.flexPx / totalFlexPx) * 100).toFixed(4)}%`
  })

  const columnMinWidthsPx = specs.map((spec) => spec.minPx)
  const minWidthPx =
    columnMinWidthsPx.reduce((sum, px) => sum + px, 0) + actionsWidthPx

  return {
    columnMinWidthsPx,
    columnWidths,
    actionsWidthPx,
    minWidthPx,
  }
}

function parseExplicitPx(width: string | undefined): number | null {
  if (!width) {
    return null
  }
  const match = /^\s*(\d+(?:\.\d+)?)px\s*$/i.exec(width)
  return match ? Number(match[1]) : null
}

function defaultColumnWidthPx<Id extends string>(
  column: ListColumn<Id>,
  index: number,
  dense: boolean,
): number {
  const id = column.id

  if (id === "when" || id === "lastLogin") {
    return dense ? 164 : 176
  }

  const isDate =
    /date/i.test(id) ||
    /date/i.test(column.label) ||
    /(?:On|At)$/.test(id) ||
    /^(?:month|period)$/i.test(id)

  if (isDate) {
    return dense ? 120 : 122
  }

  if (/^progress/i.test(id)) {
    return dense ? 116 : 116
  }

  if (column.align === "center") {
    return dense ? 112 : 120
  }

  if (column.align === "right") {
    if (/(?:pct|percent|probability|rate|qty|quantity|count|employees)$/i.test(id)) {
      return dense ? 108 : 114
    }
    return dense ? 132 : 136
  }

  if (/^(?:currency|code|documentNo|number)$/i.test(id)) {
    return dense ? 124 : 132
  }

  if (/^(?:kind|type|direction|role)$/i.test(id)) {
    return dense ? 136 : 144
  }

  if (/^(?:status|isActive)$/i.test(id)) {
    return dense ? 148 : 156
  }

  if (
    /(?:phase|stage|currentStage|category|vendorField|source|sourceKind|paymentMethod|bankingChannel|method|department|designation|workType|projectType|who)$/i.test(
      id,
    )
  ) {
    return dense ? 176 : 172
  }

  if (
    /(?:location|address|contact|email|description|notes|recoveryPlan|record|reference|detail|action)$/i.test(
      id,
    )
  ) {
    return dense ? 208 : 198
  }

  if (index === 0) {
    return dense ? 248 : 236
  }

  return dense ? 196 : 192
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
