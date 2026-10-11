const groupedCount = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
})

const groupedWhole = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const groupedMoney = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const shortMonths = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

export const DEFAULT_LAUNCH_DATE = "2021-01-01"

export function formatGroupedCount(value: number): string {
  return groupedCount.format(Math.trunc(value))
}

export function formatGroupedAmount(value: number, fractionDigits: 0 | 2): string {
  const safe = Number.isFinite(value) ? value : 0
  return (fractionDigits === 2 ? groupedMoney : groupedWhole).format(safe)
}

export function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

export function formatMoney(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  return groupedMoney.format(safe)
}

export function formatTaka(value: number): string {
  if (value < 0) {
    return `-৳${formatMoney(Math.abs(value))}`
  }

  return `৳${formatMoney(value)}`
}

export function formatCount(value: number): string {
  return String(Math.trunc(value))
}

const isoDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
})

export function formatDayMonYear(value: string): string {
  const parts = isoParts(value)
  if (!parts) {
    return value || "—"
  }

  return `${parts.day} ${shortMonths[parts.month - 1]}, ${parts.year}`
}

export function normalizeLaunchDate(value: string | null | undefined): string {
  const iso = (value ?? "").slice(0, 10)
  return isoParts(iso) ? iso : DEFAULT_LAUNCH_DATE
}

function isoParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
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
    return null
  }

  return { year, month, day }
}

export function formatIsoDate(value: string): string {
  const parts = isoParts(value)
  if (!parts) {
    return value || "—"
  }

  return isoDateFormatter.format(new Date(parts.year, parts.month - 1, parts.day))
}
