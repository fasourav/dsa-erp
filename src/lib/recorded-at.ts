import { formatIsoDate } from "@/lib/format"

export function formatRecordedAt(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value ? formatIsoDate(value.slice(0, 10)) : "—"
  }

  const day = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(date)
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(date)
  return `${formatIsoDate(day)}, ${time}`
}
