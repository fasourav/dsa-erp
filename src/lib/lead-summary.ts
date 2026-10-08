export const PAGE_SIZE = 10

export const COLUMN_STORAGE_KEY = "dsa-erp.leads.columns"

export type ColumnId =
  | "leadName"
  | "addedOn"
  | "projectName"
  | "currentStage"
  | "source"
  | "estimatedValue"
  | "probability"
  | "status"

export type OptionalColumnId = Exclude<ColumnId, "leadName" | "status">

export type ColumnVisibility = Record<OptionalColumnId, boolean>

export type SortDirection = "asc" | "desc"

export type SortState = {
  key: ColumnId
  direction: SortDirection
}

type ColumnFormat = "text" | "date" | "money" | "percent" | "status"

export type DataColumn = {
  id: ColumnId
  label: string
  align: "left" | "right"
  locked: boolean
  format: ColumnFormat
}

export const dataColumns: readonly DataColumn[] = [
  {
    id: "leadName",
    label: "Lead Name",
    align: "left",
    locked: true,
    format: "text",
  },
  {
    id: "addedOn",
    label: "Lead Add Date",
    align: "left",
    locked: false,
    format: "date",
  },
  {
    id: "projectName",
    label: "Project Name",
    align: "left",
    locked: false,
    format: "text",
  },
  {
    id: "currentStage",
    label: "Stage",
    align: "left",
    locked: false,
    format: "text",
  },
  {
    id: "source",
    label: "Source",
    align: "left",
    locked: false,
    format: "text",
  },
  {
    id: "estimatedValue",
    label: "Est. Value",
    align: "right",
    locked: false,
    format: "money",
  },
  {
    id: "probability",
    label: "Probability",
    align: "right",
    locked: false,
    format: "percent",
  },
  {
    id: "status",
    label: "Status",
    align: "left",
    locked: true,
    format: "status",
  },
]

const defaultVisibility: ColumnVisibility = {
  addedOn: true,
  projectName: true,
  currentStage: true,
  source: true,
  estimatedValue: true,
  probability: true,
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
    if (!isOptionalColumn(column.id)) continue
    const stored = record[column.id]
    if (typeof stored === "boolean") {
      visibility[column.id] = stored
    }
  }

  return visibility
}

export function isOptionalColumn(id: ColumnId): id is OptionalColumnId {
  return id !== "leadName" && id !== "status"
}

export function isColumnVisible(
  id: ColumnId,
  visibility: ColumnVisibility,
): boolean {
  if (!isOptionalColumn(id)) return true
  return visibility[id]
}
