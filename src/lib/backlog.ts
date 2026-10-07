import type { ProjectStatus } from "@/lib/project-summary"
import {
  sanitizeColumnVisibility,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

export type BacklogRow = {
  id: string
  projectName: string
  projectValue: number
  amountPaid: number
  totalExpense: number
  backlogAmount: number
  status: ProjectStatus | null
  recoveryPlan: string
}

export type BacklogColumnId =
  | "projectName"
  | "projectValue"
  | "amountPaid"
  | "totalExpense"
  | "backlogAmount"
  | "status"
  | "recoveryPlan"

export type BacklogOptionalColumnId = Exclude<BacklogColumnId, "projectName">

export type BacklogColumnVisibility = Record<BacklogOptionalColumnId, boolean>

export const backlogColumns: readonly ListColumn<BacklogColumnId>[] = [
  { id: "projectName", label: "Project", align: "left", locked: true },
  { id: "projectValue", label: "Project Value", align: "right", locked: false },
  { id: "amountPaid", label: "Amount Paid", align: "right", locked: false },
  { id: "totalExpense", label: "Total Expense", align: "right", locked: false },
  { id: "backlogAmount", label: "Backlog Amount", align: "right", locked: false },
  { id: "status", label: "Status", align: "left", locked: false },
  { id: "recoveryPlan", label: "Recovery Plan", align: "left", locked: false },
]

const defaultVisibility: BacklogColumnVisibility = {
  projectValue: true,
  amountPaid: true,
  totalExpense: true,
  backlogAmount: true,
  status: true,
  recoveryPlan: true,
}

export function defaultBacklogColumns(): BacklogColumnVisibility {
  return { ...defaultVisibility }
}

export function sanitizeBacklogColumns(value: unknown): BacklogColumnVisibility {
  return sanitizeColumnVisibility(
    [
      "projectValue",
      "amountPaid",
      "totalExpense",
      "backlogAmount",
      "status",
      "recoveryPlan",
    ],
    defaultBacklogColumns(),
    value,
  )
}

export function sortBacklog(
  rows: readonly BacklogRow[],
  sort: SortState<BacklogColumnId>,
): BacklogRow[] {
  const direction = sort.direction === "asc" ? 1 : -1

  return [...rows].sort((left, right) => {
    const primary = compareRows(left, right, sort.key) * direction
    if (primary !== 0) {
      return primary
    }

    return left.id.localeCompare(right.id)
  })
}

function compareRows(
  left: BacklogRow,
  right: BacklogRow,
  key: BacklogColumnId,
): number {
  switch (key) {
    case "projectName":
    case "recoveryPlan":
      return left[key].localeCompare(right[key], "en", { sensitivity: "base" })
    case "status":
      return (left.status ?? "").localeCompare(right.status ?? "")
    case "projectValue":
    case "amountPaid":
    case "totalExpense":
    case "backlogAmount":
      return left[key] - right[key]
  }
}
