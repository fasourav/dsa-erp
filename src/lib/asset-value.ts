export function sumAssetCurrentValue(values: readonly number[]): number {
  const total = values.reduce((sum, value) => sum + value, 0)
  return Math.round(total * 100) / 100
}

/**
 * Straight-line value as of a business date (YYYY-MM-DD, Asia/Dhaka).
 * Mirrors public.dashboard_details so the Assets page and the dashboard agree.
 */
export function assetValue(
  purchaseDate: string,
  totalCost: number,
  lifespanYears: number,
  asOf: string,
): { currentValue: number; monthlyDepreciation: number } {
  const lifespanMonths = lifespanYears * 12
  if (lifespanMonths <= 0) {
    return { currentValue: roundMoney(Math.max(0, totalCost)), monthlyDepreciation: 0 }
  }

  const used = Math.min(lifespanMonths, Math.max(0, monthsBetween(purchaseDate, asOf)))
  const rate = totalCost / lifespanMonths

  return {
    monthlyDepreciation: roundMoney(rate),
    currentValue: roundMoney(Math.max(0, totalCost - used * rate)),
  }
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

function monthsBetween(purchaseDate: string, asOf: string): number {
  const start = ISO_DATE.exec(purchaseDate)
  const end = ISO_DATE.exec(asOf)
  if (!start || !end) return 0

  const endYear = Number(end[1])
  const endMonth = Number(end[2])
  let years = endYear - Number(start[1])
  let months = endMonth - Number(start[2])
  let days = Number(end[3]) - Number(start[3])

  if (days < 0) {
    months -= 1
    // Length of the month before the as-of month (UTC math: no zone shift).
    days += new Date(Date.UTC(endYear, endMonth - 1, 0)).getUTCDate()
  }

  if (months < 0) {
    years -= 1
    months += 12
  }

  if (years < 0) return 0
  return years * 12 + months + days / 30
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
