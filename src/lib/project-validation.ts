import { businessDate } from "@/lib/business-time"
import type { ProjectStatus } from "@/lib/project-summary"

const statuses: readonly ProjectStatus[] = ["active", "completed"]

export function isProjectStatus(value: string): value is ProjectStatus {
  return statuses.includes(value as ProjectStatus)
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

/** Matches the DB `numeric(12,2)`-style cap (৳99,99,99,999.99). */
export const MAX_AMOUNT = 999_999_999.99

export function parseProjectValue(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "")
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_AMOUNT) {
    return null
  }

  return parsed
}

/** Why an amount is not accepted, or null when it is valid (blank counts as valid). */
export function amountError(value: string, label: string): string | null {
  const trimmed = value.trim().replace(/,/g, "")
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return `Enter a valid ${label}.`
  if (parsed < 0) return `The ${label} can't be negative.`
  if (parsed > MAX_AMOUNT) return `The ${label} can't be more than ৳99,99,99,999.99.`
  return null
}

/** Today's business date (YYYY-MM-DD) in Asia/Dhaka. Kept for existing call sites. */
export function todayIsoDate(): string {
  return businessDate()
}

export function dateInputValue(value: string): string {
  const date = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ""
}

/** Today's date (YYYY-MM-DD) in the business time zone, Asia/Dhaka. */
export function businessTodayIsoDate(): string {
  return businessDate()
}

export function isFutureIsoDate(value: string): boolean {
  return value > businessTodayIsoDate()
}
