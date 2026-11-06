// Single business clock. Timestamps stay UTC in storage; "today", the current
// month, and day boundaries are Asia/Dhaka (UTC+6, no DST) regardless of the
// server/browser time zone. Date-only fields (YYYY-MM-DD) never pass through here.
export const BUSINESS_TIME_ZONE = "Asia/Dhaka"

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: BUSINESS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const clockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
})

/** Business date (YYYY-MM-DD) in Asia/Dhaka. */
export function businessDate(now: Date = new Date()): string {
  return dateFormat.format(now)
}

export function businessYearMonth(now: Date = new Date()): { year: number; month: number } {
  const day = businessDate(now)
  return { year: Number(day.slice(0, 4)), month: Number(day.slice(5, 7)) }
}

/** UTC ISO instant of Dhaka midnight starting `day` (+ `addDays`). */
export function businessDayStartUtc(day: string, addDays = 0): string {
  const date = new Date(`${day}T00:00:00+06:00`)
  date.setUTCDate(date.getUTCDate() + addDays)
  return date.toISOString()
}

/** Wall-clock time in Asia/Dhaka, e.g. "9:05 PM". */
export function formatBusinessClock(value: Date): string {
  return clockFormat.format(value)
}
