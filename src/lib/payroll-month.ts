export const monthNames = [
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

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

export function netPay(
  salary: number,
  allowance: number,
  bonus: number,
  deduction: number,
): number {
  return roundMoney(salary + allowance + bonus - deduction)
}

export function monthLabel(year: number, month: number): string {
  return `${monthNames[month - 1] ?? ""} ${year}`.trim()
}

export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function parseMonthKey(
  value: string,
): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }

  const year = Number(match[1])
  const month = Number(match[2])
  if (year < 2000 || year > 2100 || month < 1 || month > 12) {
    return null
  }

  return { year, month }
}

export function monthStartIso(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`
}

export function monthEndIso(year: number, month: number): string {
  const day = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function workedInMonth(
  employee: { isActive: boolean; joiningDate: string; leaveDate: string },
  year: number,
  month: number,
): boolean {
  if (!employee.isActive) {
    return false
  }

  const start = monthStartIso(year, month)
  const end = monthEndIso(year, month)
  if (!employee.joiningDate || employee.joiningDate > end) {
    return false
  }

  if (employee.leaveDate && employee.leaveDate < start) {
    return false
  }

  return true
}
