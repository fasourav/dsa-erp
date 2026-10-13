import { dhakaToday } from "@/lib/dashboard-metrics"
import { DEFAULT_LAUNCH_DATE, normalizeLaunchDate } from "@/lib/format"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function launchFloor(value: string | null | undefined): string {
  const launch = normalizeLaunchDate(value)
  return launch < DEFAULT_LAUNCH_DATE ? DEFAULT_LAUNCH_DATE : launch
}

export function officeToday(now = new Date()): string {
  return dhakaToday(now)
}

export function reportYears(launch: string, today: string): number[] {
  const start = Number(launch.slice(0, 4))
  const end = Number(today.slice(0, 4))
  const years: number[] = []
  for (let year = end; year >= start; year -= 1) {
    years.push(year)
  }
  return years
}

export function periodForYear(
  year: number,
  launch: string,
  today: string,
): { from: string; to: string } {
  const end = year === Number(today.slice(0, 4)) ? today : `${year}-12-31`
  return clampPeriod(`${year}-01-01`, end, launch, today)
}

export function clampPeriod(
  from: string,
  to: string,
  launch: string,
  today: string,
): { from: string; to: string } {
  let start = ISO_DATE.test(from) ? from : launch
  let end = ISO_DATE.test(to) ? to : today
  if (start < launch) start = launch
  if (end > today) end = today
  if (end < launch) end = launch
  if (start > end) start = end
  return { from: start, to: end }
}

export function currentReportPeriod(launch: string, today = officeToday()): {
  from: string
  to: string
} {
  return periodForYear(Number(today.slice(0, 4)), launch, today)
}
