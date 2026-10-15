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
  const sign = safe < 0 ? "-" : ""
  return `${sign}৳${groupedMoney.format(Math.abs(safe))}`
}

export function formatTaka(value: number): string {
  return formatMoney(value)
}

export function formatCount(value: number): string {
  return String(Math.trunc(value))
}

export function formatDayMonYear(value: string): string {
  const parts = isoParts(value)
  if (!parts) {
    return value || "—"
  }

  return formatParts(parts)
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

  return formatParts(parts)
}

function formatParts(parts: { year: number; month: number; day: number }): string {
  const day = String(parts.day).padStart(2, "0")
  return `${day} ${shortMonths[parts.month - 1]} ${parts.year}`
}

/** Capitalises each all-lowercase word of a person or company name; keeps acronyms and mixed case. */
export function titleCaseName(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => (word === word.toLowerCase() ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ")
}
