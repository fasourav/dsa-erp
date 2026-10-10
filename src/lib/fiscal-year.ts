const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

export const fiscalMonthOptions = monthNames.map((label, index) => ({
  value: String(index + 1),
  label,
}))

export type YearPeriod = {
  startYear: number
  from: string
  to: string
  label: string
}

export function fiscalYearPeriod(startMonth: number, startYear: number): YearPeriod {
  const month = clampMonth(startMonth)
  if (month === 1) {
    return {
      startYear,
      from: `${startYear}-01-01`,
      to: `${startYear}-12-31`,
      label: `FY ${startYear}`,
    }
  }

  const endYear = startYear + 1
  const endMonth = month - 1
  return {
    startYear,
    from: `${startYear}-${pad(month)}-01`,
    to: `${endYear}-${pad(endMonth)}-${lastDay(endYear, endMonth)}`,
    label: `FY ${startYear}–${String(endYear).slice(-2)}`,
  }
}

export function currentFiscalYear(startMonth: number, today: string): YearPeriod {
  const month = clampMonth(startMonth)
  const year = Number(today.slice(0, 4))
  const currentMonth = Number(today.slice(5, 7))
  const startYear = currentMonth >= month ? year : year - 1
  return fiscalYearPeriod(month, startYear)
}

export function taxYearPeriod(startYear: number): YearPeriod {
  const period = fiscalYearPeriod(7, startYear)
  return { ...period, label: `Tax Year ${startYear}–${String(startYear + 1).slice(-2)}` }
}

export function currentTaxYear(today: string): YearPeriod {
  return taxYearPeriod(currentFiscalYear(7, today).startYear)
}

function clampMonth(month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return 7
  }
  return month
}

function pad(month: number): string {
  return String(month).padStart(2, "0")
}

function lastDay(year: number, month: number): string {
  return String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")
}
