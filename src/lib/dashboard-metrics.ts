// FY labels are calendar years. Nothing in the database stores a separate fiscal calendar.
// Selected-year figures are year-to-date when that year is still in progress.

export const HIGH_VALUE_PROJECT_MIN = 50_000

const LAKH = 100_000
const CRORE = 10_000_000
const DAY_MS = 86_400_000

const MONTHS = [
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

export type ChartPoint = {
  label: string
  value: number
}

export type YearSnapshot = {
  year: number
  revenue: number
  revenueDelta: number | null
  grossProfit: number
  grossDelta: number | null
  netProfit: number
  netDelta: number | null
  totalExpense: number
  expenseDelta: number | null
  outflow: number
  material: number
  subcontractor: number
  tax: number
  admin: number
  operational: number
  marketing: number
  salary: number
  projectExpense: number
  collectionRate: number
  expenseRatio: number
  grossMargin: number
  projectCostRatio: number
  taxRatio: number
  adminRatio: number
  revenueSpark: ChartPoint[]
  grossSpark: ChartPoint[]
  netSpark: ChartPoint[]
}

export type WeekPoint = {
  label: string
  revenue: number
  projectExpense: number
  adminExpense: number
  totalExpense: number
  netProfit: number
}

export type AnnualPoint = {
  label: string
  grossProfit: number
}

export type TrendPoint = {
  label: string
  count: number
}

export type DashboardInput = {
  projects: {
    totalValue: number
    status: "active" | "completed"
    startedOn: string
    year: number | null
  }[]
  clientCount: number
  leads: { status: string; estimatedValue: number; isOpen: boolean }[]
  revenue: { date: string; amount: number }[]
  vendorPayments: {
    date: string
    amount: number
    workType: string | null
    projectLinked: boolean
  }[]
  operational: {
    date: string
    amount: number
    category: string
    projectLinked: boolean
  }[]
  taxes: { date: string; amount: number }[]
  bank: {
    date: string
    amount: number
    direction: "inflow" | "outflow"
    sourceKind: string
  }[]
  openingBalance: number
  billed: number
  ledgerPaid: number
  receivables: number
  payables: number
  backlogCount: number
}

export type DashboardModel = {
  updatedLabel: string
  updatedIso: string
  defaultYear: number
  years: number[]
  snapshots: YearSnapshot[]
  cashBalance: number
  cashDelta: number | null
  cashSpark: ChartPoint[]
  receivables: number
  payables: number
  forecastedProfit: number
  weeks: WeekPoint[]
  weekCaption: string
  annual: AnnualPoint[]
  annualCaption: string
  trend: TrendPoint[]
  trendCaption: string
  performance: {
    projectCount: number
    sinceYear: number | null
    highValue: number
    lowValue: number
    active: number
    openLeads: number
    clients: number
    leadValue: number
    winRate: number
    collectionEfficiency: number
    backlog: number
  }
  tenure: {
    launchDateLabel: string
    inOperation: string
    daysLabel: string
    revenuePerDay: number
    netProfitPerDay: number
  }
}

type Dated = { date: string; amount: number }

export function dhakaToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

export function formatUpdatedAt(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(now)
}

function signed(value: number): { sign: string; abs: number } {
  if (value < 0) return { sign: "−", abs: -value }
  return { sign: "", abs: value }
}

export function formatExactBdt(value: number): string {
  const { sign, abs } = signed(value)
  const hasFraction = Math.round(abs * 100) % 100 !== 0
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(abs)
  return `${sign}৳${formatted}`
}

export function formatCompactBdt(value: number): string {
  const { sign, abs } = signed(value)
  if (abs >= CRORE) {
    return `${sign}৳${(abs / CRORE).toFixed(2)} Cr`
  }
  if (abs >= LAKH) {
    return `${sign}৳${(abs / LAKH).toFixed(2)} L`
  }
  return formatExactBdt(value)
}

export function formatCompactParts(value: number): {
  text: string
  unit: string
} {
  const { sign, abs } = signed(value)
  if (abs >= CRORE) {
    return { text: `${sign}৳${(abs / CRORE).toFixed(2)}`, unit: "Cr" }
  }
  if (abs >= LAKH) {
    return { text: `${sign}৳${(abs / LAKH).toFixed(2)}`, unit: "L" }
  }
  return { text: formatExactBdt(value), unit: "" }
}

export function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  return `${sign}${Math.abs(value).toFixed(1)}%`
}

export function formatRatio(value: number): string {
  const sign = value < 0 ? "−" : ""
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

export function formatShare(part: number, total: number): string {
  if (total <= 0) {
    return "0.0%"
  }
  return `${((part / total) * 100).toFixed(1)}%`
}

export function formatAxisBdt(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? "−" : ""
  if (abs >= CRORE) {
    return `${sign}৳${(abs / CRORE).toFixed(1)}Cr`
  }
  if (abs >= LAKH) {
    return `${sign}৳${(abs / LAKH).toFixed(abs >= 10 * LAKH ? 0 : 1)}L`
  }
  if (abs >= 1000) {
    return `${sign}৳${Math.round(abs / 1000)}k`
  }
  return `${sign}৳${Math.round(abs)}`
}

export function weekTrend(
  current: number,
  previous: number | undefined,
): "up" | "down" | "flat" {
  if (previous == null || current === previous) {
    return "flat"
  }
  return current > previous ? "up" : "down"
}

export function buildDashboard(input: DashboardInput, now: Date): DashboardModel {
  const today = dhakaToday(now)
  const currentYear = Number(today.slice(0, 4))
  const revenue = dated(input.revenue)
  const vendorPayments = dated(input.vendorPayments)
  const operational = dated(input.operational)
  const taxes = dated(input.taxes)
  const bank = dated(input.bank)

  const years = new Set<number>([currentYear])
  for (const row of [...revenue, ...vendorPayments, ...operational, ...taxes, ...bank]) {
    years.add(Number(row.date.slice(0, 4)))
  }
  for (const project of input.projects) {
    const year = projectYear(project)
    if (year != null) {
      years.add(year)
    }
  }

  const axisYears = [...years].sort((left, right) => left - right)
  const collectionRate = percentOf(input.ledgerPaid, input.billed)
  const snapshots = axisYears.map((year) =>
    buildYear(year, today, currentYear, {
      revenue,
      vendorPayments,
      operational,
      taxes,
      bank,
      collectionRate,
    }),
  )

  const allRevenue = sum(revenue)
  const allVendor = sum(vendorPayments)
  const allOperational = sum(operational)
  const allTax = sum(taxes)
  // Paid salaries are bank outflows. Operational rows already categorized as
  // salary stay inside allOperational, so they are not added again here.
  const bankPayroll = bank
    .filter((row) => row.sourceKind === "payroll" && row.direction === "outflow")
    .reduce((total, row) => total + row.amount, 0)
  const allNet = allRevenue - allVendor - allOperational - allTax - bankPayroll
  const contractValue = input.projects.reduce(
    (total, project) => total + project.totalValue,
    0,
  )

  const cashBalance = balanceAsOf(bank, today, input.openingBalance)
  const cashDelta = changePercent(
    cashBalance,
    balanceAsOf(bank, previousMonthEnd(today), input.openingBalance),
  )

  const launch = earliestDate([
    ...input.projects.map((project) => project.startedOn),
    ...revenue.map((row) => row.date),
    ...vendorPayments.map((row) => row.date),
    ...operational.map((row) => row.date),
    ...taxes.map((row) => row.date),
    ...bank.map((row) => row.date),
  ], today)
  const span = calendarSpan(launch, today)
  // Launch day itself is a full day of operation, so a same-day span still divides by 1.
  const operatingDays = Math.max(span.totalDays, 1)

  const projectYears = input.projects
    .map((project) => projectYear(project))
    .filter((year): year is number => year != null)
  const sinceYear = projectYears.length > 0 ? Math.min(...projectYears) : null
  const won = input.leads.filter((lead) => lead.status === "won").length
  const lost = input.leads.filter((lead) => lead.status === "lost").length

  const latestWeek = isoWeek(today)
  const weeks = lastWeeks(today, 12, {
    revenue,
    vendorPayments,
    operational,
    taxes,
    bank,
  })

  const annual = axisYears.map((year) => ({
    label: `FY${year}`,
    grossProfit: grossBetween(
      revenue,
      vendorPayments,
      operational,
      `${year}-01-01`,
      year === currentYear ? today : `${year}-12-31`,
    ),
  }))
  const firstAnnual = axisYears[0] ?? currentYear
  const lastAnnual = axisYears[axisYears.length - 1] ?? currentYear
  const annualCaption =
    firstAnnual === lastAnnual
      ? `Gross Profit FY${firstAnnual}${lastAnnual === currentYear ? " (FY" + currentYear + " YTD)" : ""}`
      : `Gross Profit FY${firstAnnual} – FY${lastAnnual}${lastAnnual === currentYear ? " (FY" + currentYear + " YTD)" : ""}`

  return {
    updatedLabel: formatUpdatedAt(now),
    updatedIso: now.toISOString(),
    defaultYear: years.has(currentYear) ? currentYear : axisYears[axisYears.length - 1],
    years: [...axisYears].sort((left, right) => right - left),
    snapshots,
    cashBalance,
    cashDelta,
    cashSpark: monthEnds(currentYear, today, bank, input.openingBalance),
    receivables: input.receivables,
    payables: input.payables,
    // Best effort: profit if open invoices are collected and open payables are paid.
    // Uncommitted future costs are not included.
    forecastedProfit: allNet + input.receivables - input.payables,
    weeks,
    weekCaption: `${formatRange(latestWeek.start, latestWeek.end)} (W${latestWeek.week}) · Last 12 Weeks`,
    annual,
    annualCaption,
    trend: axisYears.map((year) => ({
      label: String(year),
      count: input.projects.filter((project) => projectYear(project) === year).length,
    })),
    trendCaption: `${input.projects.length} Total`,
    performance: {
      projectCount: input.projects.length,
      sinceYear,
      highValue: input.projects.filter(
        (project) => project.totalValue >= HIGH_VALUE_PROJECT_MIN,
      ).length,
      lowValue: input.projects.filter(
        (project) => project.totalValue < HIGH_VALUE_PROJECT_MIN,
      ).length,
      active: input.projects.filter((project) => project.status === "active").length,
      openLeads: input.leads.filter((lead) => lead.isOpen).length,
      clients: input.clientCount,
      leadValue: input.leads
        .filter((lead) => lead.isOpen)
        .reduce((total, lead) => total + lead.estimatedValue, 0),
      // Won leads divided by won + lost. Open, on hold, and cancelled leads are not decided.
      winRate: percentOf(won, won + lost),
      // Cash collected over contracted project value. Collection Rate uses the invoice ledger.
      collectionEfficiency: percentOf(allRevenue, contractValue),
      // project_backlogs: spend already above collections, not a not-started phase.
      backlog: input.backlogCount,
    },
    tenure: {
      launchDateLabel: formatLongDate(launch),
      inOperation: formatOperation(span),
      daysLabel: `${span.totalDays.toLocaleString("en-US")} Days Since Launch`,
      revenuePerDay: Math.round(allRevenue / operatingDays),
      netProfitPerDay: Math.round(allNet / operatingDays),
    },
  }
}

type Books = {
  revenue: Dated[]
  vendorPayments: (Dated & { workType: string | null; projectLinked: boolean })[]
  operational: (Dated & { category: string; projectLinked: boolean })[]
  taxes: Dated[]
  bank: (Dated & { direction: "inflow" | "outflow"; sourceKind: string })[]
  collectionRate: number
}

function buildYear(year: number, today: string, currentYear: number, books: Books): YearSnapshot {
  const current = yearWindow(year, today, currentYear)
  const prior = priorWindow(year, today, currentYear)
  const expenses = expenseTotals(books, current.start, current.end)
  const priorExpenses = expenseTotals(books, prior.start, prior.end)
  const revenue = totalBetween(books.revenue, current.start, current.end)
  const priorRevenue = totalBetween(books.revenue, prior.start, prior.end)
  const grossProfit = grossBetween(
    books.revenue,
    books.vendorPayments,
    books.operational,
    current.start,
    current.end,
  )
  const priorGross = grossBetween(
    books.revenue,
    books.vendorPayments,
    books.operational,
    prior.start,
    prior.end,
  )
  const netProfit = revenue - expenses.total
  const priorNet = priorRevenue - priorExpenses.total

  return {
    year,
    revenue,
    revenueDelta: changePercent(revenue, priorRevenue),
    grossProfit,
    grossDelta: changePercent(grossProfit, priorGross),
    netProfit,
    netDelta: changePercent(netProfit, priorNet),
    totalExpense: expenses.total,
    expenseDelta: changePercent(expenses.total, priorExpenses.total),
    outflow: books.bank.reduce((total, row) => {
      // Transfers, deposits, and withdrawals change the bank balance only.
      // They are not income or expense, so they stay out of this Outflow total.
      if (!countsAsExpenseOutflow(row) || row.date < current.start || row.date > current.end) {
        return total
      }
      return total + row.amount
    }, 0),
    material: expenses.material,
    subcontractor: expenses.subcontractor,
    tax: expenses.tax,
    admin: expenses.admin,
    operational: expenses.operational,
    marketing: expenses.marketing,
    salary: expenses.salary,
    projectExpense: expenses.material + expenses.subcontractor,
    // Whole receivable ledger. Invoice dates do not make a clean fiscal cut of this rate.
    collectionRate: books.collectionRate,
    expenseRatio: percentOf(expenses.total, revenue),
    grossMargin: percentOf(grossProfit, revenue),
    projectCostRatio: percentOf(expenses.material + expenses.subcontractor, expenses.total),
    taxRatio: percentOf(expenses.tax, revenue),
    adminRatio: percentOf(expenses.admin, revenue),
    revenueSpark: monthSpark(year, today, (start, end) =>
      totalBetween(books.revenue, start, end),
    ),
    grossSpark: monthSpark(year, today, (start, end) =>
      grossBetween(books.revenue, books.vendorPayments, books.operational, start, end),
    ),
    netSpark: monthSpark(year, today, (start, end) => {
      const monthRevenue = totalBetween(books.revenue, start, end)
      return monthRevenue - expenseTotals(books, start, end).total
    }),
  }
}

type ExpenseTotals = {
  material: number
  subcontractor: number
  tax: number
  admin: number
  operational: number
  marketing: number
  salary: number
  total: number
}

function expenseTotals(books: Books, start: string, end: string): ExpenseTotals {
  const totals: ExpenseTotals = {
    material: 0,
    subcontractor: 0,
    tax: 0,
    admin: 0,
    operational: 0,
    marketing: 0,
    salary: 0,
    total: 0,
  }

  for (const row of books.vendorPayments) {
    if (!inSpan(row.date, start, end)) continue
    // Operational purchase orders have no project. Their payments stay in Total
    // Expense as Operational Expense, and stay out of material, subcontractor,
    // and project expense.
    if (!row.projectLinked) {
      totals.operational += row.amount
      continue
    }
    // Vendor payments do not store Material vs Subcontractor. Supply, material, and goods
    // work types count as Material Cost. Every other project purchase-order payment is Subcontractor Cost.
    const bucket = isMaterialWork(row.workType) ? "material" : "subcontractor"
    totals[bucket] += row.amount
  }

  for (const row of books.operational) {
    if (!inSpan(row.date, start, end)) continue
    totals[classifyOperational(row.category)] += row.amount
  }

  for (const row of books.taxes) {
    if (!inSpan(row.date, start, end)) continue
    totals.tax += row.amount
  }

  for (const row of books.bank) {
    if (row.sourceKind !== "payroll" || row.direction !== "outflow") continue
    if (!inSpan(row.date, start, end)) continue
    // Employee Salary is paid payroll on the bank ledger, plus operational
    // rows categorized as salary. Draft and approved payroll is not included.
    totals.salary += row.amount
  }

  totals.total =
    totals.material +
    totals.subcontractor +
    totals.tax +
    totals.admin +
    totals.operational +
    totals.marketing +
    totals.salary
  return totals
}

function grossBetween(
  revenue: Dated[],
  vendorPayments: (Dated & { projectLinked: boolean })[],
  operational: (Dated & { projectLinked: boolean })[],
  start: string,
  end: string,
): number {
  // Matches project_financials: collections minus project purchase-order payments
  // minus project-linked overhead. Operational purchase orders have no project,
  // so their payments stay out of project gross profit and project-cost ratios.
  return (
    totalBetween(revenue, start, end) -
    totalBetween(
      vendorPayments.filter((row) => row.projectLinked),
      start,
      end,
    ) -
    totalBetween(
      operational.filter((row) => row.projectLinked),
      start,
      end,
    )
  )
}

export function isMaterialWork(workType: string | null): boolean {
  const name = (workType ?? "").toLowerCase()
  return name.includes("material") || name.includes("supply") || name.includes("goods")
}

export function classifyOperational(
  category: string,
): "admin" | "operational" | "marketing" | "salary" {
  const name = category.trim().toLowerCase()
  if (name.includes("salary") || name.includes("payroll") || name.includes("wage")) {
    return "salary"
  }
  if (name.includes("market") || name.includes("advert") || name.includes("promotion")) {
    return "marketing"
  }
  // Office overhead, including "Office Materials", stays out of project Material Cost.
  if (
    name.includes("admin") ||
    name.includes("office") ||
    name.includes("rent") ||
    name.includes("utilit")
  ) {
    return "admin"
  }
  return "operational"
}

function lastWeeks(
  today: string,
  count: number,
  books: Pick<Books, "revenue" | "vendorPayments" | "operational" | "taxes" | "bank">,
): WeekPoint[] {
  const current = isoWeek(today)
  const weeks: WeekPoint[] = []

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const start = addUtcDays(current.start, -7 * offset)
    const week = isoWeek(start)
    const expenses = expenseTotals({ ...books, collectionRate: 0 }, week.start, week.end)
    const weekRevenue = totalBetween(books.revenue, week.start, week.end)
    weeks.push({
      label: `W${week.week}`,
      revenue: weekRevenue,
      projectExpense: expenses.material + expenses.subcontractor,
      adminExpense: expenses.admin,
      totalExpense: expenses.total,
      netProfit: weekRevenue - expenses.total,
    })
  }

  return weeks
}

function monthSpark(
  year: number,
  today: string,
  valueFor: (start: string, end: string) => number,
): ChartPoint[] {
  const currentYear = Number(today.slice(0, 4))
  const lastMonth = year < currentYear ? 12 : year > currentYear ? 0 : Number(today.slice(5, 7))
  const windowEnd = year === currentYear ? today : `${year}-12-31`
  const points: ChartPoint[] = []

  for (let month = 1; month <= lastMonth; month += 1) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`
    const end = monthEndIso(year, month)
    points.push({
      label: MONTHS[month - 1],
      value: valueFor(start, end < windowEnd ? end : windowEnd),
    })
  }

  return points
}

function monthEnds(
  year: number,
  today: string,
  bank: (Dated & { direction: "inflow" | "outflow" })[],
  openingBalance: number,
): ChartPoint[] {
  const lastMonth = Number(today.slice(5, 7))
  const points: ChartPoint[] = []
  for (let month = 1; month <= lastMonth; month += 1) {
    const end = monthEndIso(year, month)
    points.push({
      label: MONTHS[month - 1],
      value: balanceAsOf(bank, end < today ? end : today, openingBalance),
    })
  }
  return points
}

function balanceAsOf(
  bank: (Dated & { direction: "inflow" | "outflow" })[],
  end: string,
  openingBalance: number,
): number {
  // Cash is opening balances plus every ledger line through this date,
  // including deposits, withdrawals, transfers, and payroll.
  let balance = openingBalance
  for (const row of bank) {
    if (row.date > end) continue
    balance += row.direction === "inflow" ? row.amount : -row.amount
  }
  return balance
}

const balanceOnlySources = new Set(["transfer", "deposit", "withdrawal"])

function countsAsExpenseOutflow(row: { direction: string; sourceKind: string }): boolean {
  return row.direction === "outflow" && !balanceOnlySources.has(row.sourceKind)
}

function yearWindow(year: number, today: string, currentYear: number) {
  return {
    start: `${year}-01-01`,
    end: year === currentYear ? today : `${year}-12-31`,
  }
}

function priorWindow(year: number, today: string, currentYear: number) {
  if (year === currentYear) {
    return { start: `${year - 1}-01-01`, end: shiftYear(today, -1) }
  }
  return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` }
}

function previousMonthEnd(today: string): string {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  if (month === 1) {
    return monthEndIso(year - 1, 12)
  }
  return monthEndIso(year, month - 1)
}

function monthEndIso(year: number, month: number): string {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`
}

function shiftYear(iso: string, delta: number): string {
  const year = Number(iso.slice(0, 4)) + delta
  const month = Number(iso.slice(5, 7))
  const day = Number(iso.slice(8, 10))
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`
}

function totalBetween(rows: Dated[], start: string, end: string): number {
  let total = 0
  for (const row of rows) {
    if (inSpan(row.date, start, end)) {
      total += row.amount
    }
  }
  return total
}

function sum(rows: Dated[]): number {
  return rows.reduce((total, row) => total + row.amount, 0)
}

function inSpan(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

function percentOf(part: number, whole: number): number {
  if (whole === 0) return 0
  return (part / whole) * 100
}

function changePercent(current: number, prior: number): number | null {
  if (prior === 0) return null
  return ((current - prior) / Math.abs(prior)) * 100
}

function projectYear(project: {
  year: number | null
  startedOn: string
}): number | null {
  if (project.year != null && project.year >= 1990 && project.year <= 2200) {
    return project.year
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(project.startedOn)) {
    return Number(project.startedOn.slice(0, 4))
  }
  return null
}

function dated<T extends { date: string; amount: number }>(rows: T[]): T[] {
  return rows.flatMap((row) => {
    const date = row.date.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(row.amount)) {
      return []
    }
    return [{ ...row, date, amount: row.amount }]
  })
}

function earliestDate(values: string[], today: string): string {
  // No launch date is stored in settings. Use the earliest business date on file.
  const dates = values
    .map((value) => value.slice(0, 10))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= today)
  dates.sort()
  return dates[0] ?? today
}

function calendarSpan(start: string, end: string) {
  const from = parseIsoDate(start)
  const to = parseIsoDate(end)
  let years = to.getUTCFullYear() - from.getUTCFullYear()
  let months = to.getUTCMonth() - from.getUTCMonth()
  let days = to.getUTCDate() - from.getUTCDate()
  if (days < 0) {
    months -= 1
    days += new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 0)).getUTCDate()
  }
  if (months < 0) {
    years -= 1
    months += 12
  }
  const totalDays = Math.max(0, Math.round((to.getTime() - from.getTime()) / DAY_MS))
  return { years: Math.max(0, years), months, days, totalDays }
}

function formatOperation(span: { years: number; months: number; days: number }): string {
  const parts: string[] = []
  if (span.years > 0) {
    parts.push(unit(span.years, "Year"))
  }
  if (span.months > 0 || span.years > 0) {
    parts.push(unit(span.months, "Month"))
  }
  parts.push(unit(span.days, "Day"))
  return parts.join(" ")
}

function unit(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`
}

function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseIsoDate(iso))
}

function formatRange(start: string, end: string): string {
  const opening = monthDay(start)
  const closing = monthDay(end)
  if (opening.year === closing.year && opening.month === closing.month) {
    return `${opening.month} ${opening.day}–${closing.day}, ${opening.year}`
  }
  if (opening.year === closing.year) {
    return `${opening.month} ${opening.day}–${closing.month} ${closing.day}, ${opening.year}`
  }
  return `${opening.month} ${opening.day}, ${opening.year}–${closing.month} ${closing.day}, ${closing.year}`
}

function monthDay(iso: string) {
  const date = parseIsoDate(iso)
  return {
    month: new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC",
    }).format(date),
    day: date.getUTCDate(),
    year: date.getUTCFullYear(),
  }
}

type IsoWeek = { week: number; start: string; end: string }

function isoWeek(iso: string): IsoWeek {
  const date = parseIsoDate(iso)
  const day = date.getUTCDay() || 7
  const thursday = new Date(date)
  thursday.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  const week = Math.ceil(
    (thursday.getTime() - yearStart.getTime()) / DAY_MS / 7 + 1 / 7,
  )
  const start = addUtcDays(iso, 1 - day)
  return { week, start, end: addUtcDays(start, 6) }
}

function parseIsoDate(iso: string): Date {
  return new Date(
    Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))),
  )
}

function addUtcDays(iso: string, days: number): string {
  const date = parseIsoDate(iso)
  date.setUTCDate(date.getUTCDate() + days)
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${date.getUTCFullYear()}-${month}-${day}`
}
