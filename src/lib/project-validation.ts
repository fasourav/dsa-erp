import {
  projectPhaseOptions,
  projectTypeOptions,
  type ProjectStatus,
} from "@/lib/project-summary"

const statuses: readonly ProjectStatus[] = ["active", "completed"]

export function isProjectStatus(value: string): value is ProjectStatus {
  return statuses.includes(value as ProjectStatus)
}

export function isProjectType(value: string): boolean {
  return (projectTypeOptions as readonly string[]).includes(value)
}

export function isProjectPhase(value: string): boolean {
  return (projectPhaseOptions as readonly string[]).includes(value)
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year, month - 1, day)

  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

export function parseProjectValue(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return parsed
}

export function todayIsoDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

export function dateInputValue(value: string): string {
  const date = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ""
}
