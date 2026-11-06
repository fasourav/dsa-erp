import { businessDate, formatBusinessClock } from "@/lib/business-time"
import { formatDayMonYear } from "@/lib/format"

export function lastLoginLabel(value: string | null, now: Date = new Date()): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  const day = businessDate(date)
  const today = businessDate(now)
  const yesterday = businessDate(new Date(now.getTime() - 24 * 60 * 60 * 1000))
  const time = formatBusinessClock(date)
  if (day === today) return `Today, ${time}`
  if (day === yesterday) return `Yesterday, ${time}`
  return formatDayMonYear(day)
}
