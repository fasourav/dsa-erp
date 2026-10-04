export const PAGE_SIZE = 10

export const COLUMN_STORAGE_KEY = "dsa-erp.projects.columns"

export type ProjectStatus = "active" | "completed"

export const projectTypeOptions = [
  "Site/Floor Planning",
  "Residential Interior",
  "Corporate Interior",
  "Residential Exterior",
  "Corporate Exterior",
  "Residential Apartment",
  "Single Storied Residence",
  "Duplex Residence",
  "Triplex Residence",
  "Landscape",
  "Corporate Furniture Supply",
  "Residential Furniture Supply",
  "Fire Protection System",
  "HVAC System",
  "3D Visualization",
  "Graphic Design & Print",
  "Renovation",
  "Construction",
] as const

export const projectPhaseOptions = [
  "Bidding",
  "Review",
  "Concept Design",
  "Schematic Design",
  "Construction",
  "Audit",
  "Handover",
] as const

export type ProjectRow = {
  id: string
  name: string
  clientId: string
  clientName: string
  location: string
  startedOn: string
  projectType: string
  status: ProjectStatus
  phase: string
  totalValue: number
  totalPaid: number
  totalDue: number
  grossProfit: number
  details: string
}

export type ClientOption = {
  id: string
  displayName: string
}

export type ColumnId =
  | "name"
  | "clientName"
  | "location"
  | "startedOn"
  | "projectType"
  | "status"
  | "phase"
  | "totalValue"
  | "totalPaid"
  | "totalDue"
  | "totalPercentPaid"
  | "grossProfit"
  | "grossPercentPaid"

export type OptionalColumnId = Exclude<
  ColumnId,
  "name" | "clientName" | "status" | "phase"
>

export type ColumnVisibility = Record<OptionalColumnId, boolean>

export type SortDirection = "asc" | "desc"

export type SortState = {
  key: ColumnId
  direction: SortDirection
}

type ColumnFormat = "text" | "date" | "status" | "money" | "percent"

export type DataColumn = {
  id: ColumnId
  label: string
  align: "left" | "right"
  locked: boolean
  format: ColumnFormat
}

export const dataColumns: readonly DataColumn[] = [
  {
    id: "name",
    label: "Project Name",
    align: "left",
    locked: true,
    format: "text",
  },
  {
    id: "clientName",
    label: "Client Name",
    align: "left",
    locked: true,
    format: "text",
  },
  {
    id: "location",
    label: "Location",
    align: "left",
    locked: false,
    format: "text",
  },
  {
    id: "startedOn",
    label: "Date",
    align: "left",
    locked: false,
    format: "date",
  },
  {
    id: "projectType",
    label: "Project Type",
    align: "left",
    locked: false,
    format: "text",
  },
  {
    id: "status",
    label: "Status",
    align: "left",
    locked: true,
    format: "status",
  },
  {
    id: "phase",
    label: "Project Phase",
    align: "left",
    locked: true,
    format: "text",
  },
  {
    id: "totalValue",
    label: "Total Value",
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
    id: "totalDue",
    label: "Total Due",
    align: "right",
    locked: false,
    format: "money",
  },
  {
    id: "totalPercentPaid",
    label: "Total % Paid",
    align: "right",
    locked: false,
    format: "percent",
  },
  {
    id: "grossProfit",
    label: "Gross Profit",
    align: "right",
    locked: false,
    format: "money",
  },
  {
    id: "grossPercentPaid",
    label: "Gross % Paid",
    align: "right",
    locked: false,
    format: "percent",
  },
]

const defaultVisibility: ColumnVisibility = {
  location: true,
  startedOn: true,
  projectType: true,
  totalValue: true,
  totalPaid: true,
  totalDue: true,
  totalPercentPaid: true,
  grossProfit: true,
  grossPercentPaid: true,
}

const projectDateFormatter = new Intl.DateTimeFormat("en-US", {
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
  return (
    id !== "name" && id !== "clientName" && id !== "status" && id !== "phase"
  )
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

export function clientDisplayName(
  personName: string | null,
  companyName: string | null,
): string {
  return (personName ?? companyName ?? "").trim()
}

export function statusLabel(status: ProjectStatus): string {
  switch (status) {
    case "active":
      return "Active"
    case "completed":
      return "Completed"
  }
}

export function formatProjectDate(value: string): string {
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

  return projectDateFormatter.format(date)
}

export function formatPercent(part: number, total: number): string {
  if (total === 0) {
    return "0%"
  }

  return `${((part / total) * 100).toFixed(1)}%`
}

export function paidRatio(row: ProjectRow): number {
  if (row.totalValue === 0) {
    return 0
  }

  return row.totalPaid / row.totalValue
}

export function profitRatio(row: ProjectRow): number {
  if (row.totalValue === 0) {
    return 0
  }

  return row.grossProfit / row.totalValue
}

export function sortProjects(
  projects: readonly ProjectRow[],
  sort: SortState,
): ProjectRow[] {
  const direction = sort.direction === "asc" ? 1 : -1

  return [...projects].sort((a, b) => {
    const primary = compareProjects(a, b, sort.key) * direction
    if (primary !== 0) {
      return primary
    }

    const byName = a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    if (byName !== 0) {
      return byName
    }

    return a.id.localeCompare(b.id)
  })
}

function compareProjects(a: ProjectRow, b: ProjectRow, key: ColumnId): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name, "en", { sensitivity: "base" })
    case "clientName":
      return a.clientName.localeCompare(b.clientName, "en", {
        sensitivity: "base",
      })
    case "location":
      return a.location.localeCompare(b.location, "en", { sensitivity: "base" })
    case "startedOn":
      return a.startedOn.localeCompare(b.startedOn)
    case "projectType":
      return a.projectType.localeCompare(b.projectType, "en", {
        sensitivity: "base",
      })
    case "status":
      return statusLabel(a.status).localeCompare(statusLabel(b.status), "en", {
        sensitivity: "base",
      })
    case "phase":
      return a.phase.localeCompare(b.phase, "en", { sensitivity: "base" })
    case "totalValue":
      return a.totalValue - b.totalValue
    case "totalPaid":
      return a.totalPaid - b.totalPaid
    case "totalDue":
      return a.totalDue - b.totalDue
    case "totalPercentPaid":
      return paidRatio(a) - paidRatio(b)
    case "grossProfit":
      return a.grossProfit - b.grossProfit
    case "grossPercentPaid":
      return profitRatio(a) - profitRatio(b)
  }
}

export function paginateProjects(projects: readonly ProjectRow[], page: number) {
  const total = projects.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const startIndex = (currentPage - 1) * PAGE_SIZE

  return {
    rows: projects.slice(startIndex, startIndex + PAGE_SIZE),
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

export function projectRangeLabel(
  start: number,
  end: number,
  total: number,
): string {
  if (total === 0) {
    return "0 projects"
  }

  const noun = total === 1 ? "project" : "projects"

  if (start === end) {
    return `Showing ${start} of ${total} ${noun}`
  }

  return `Showing ${start}–${end} of ${total} ${noun}`
}
