// FY labels are calendar years. Nothing in the database stores a separate fiscal calendar.
// Selected-year figures are year-to-date when that year is still in progress.
// Operational tenure uses company_settings.launch_date.

import {
  formatDayMonYear,
  formatGroupedCount,
  formatMoney,
  normalizeLaunchDate,
} from "@/lib/format"

export const DASHBOARD_FIRST_YEAR = 2021

export type NamedAmount = {
  name: string
  value: number
}

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
  expenseSpark: ChartPoint[]
  withdrawal: number
  material: number
  subcontractor: number
  projectOverhead: number
  tax: number
  admin: number
  operational: number
  marketing: number
  salary: number
  projectExpense: number
  collectionRate: number
  expenseRatio: number
  grossMargin: number
  netMargin: number
  withdrawalRatio: number
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
  leads: { status: string; estimatedValue: number; isOpen: boolean; addedOn: string }[]
  clients: { createdOn: string }[]
  invoices: {
    issuedOn: string
    amount: number
    voided: boolean
    payments: { date: string; amount: number }[]
  }[]
  orders: {
    issuedOn: string
    totalValue: number
    projectLinked: boolean
    payments: { date: string; amount: number }[]
  }[]
  backlogYears: number[]
  revenue: { date: string; amount: number }[]
  vendorPayments: {
    date: string
    amount: number
    workType: string | null
    expenseCategory: string | null
    officeCategory: string | null
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
  launchDate: string
}

export type DashboardModel = {
  updatedLabel: string
  updatedIso: string
  scopeYear: number | null
  scopeLabel: string
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
    active: number
    openLeads: number
    clients: number
    leadValue: number
    winRate: number
    collectionEfficiency: number
    backlog: number
    backlogValue: number
    highestProject: NamedAmount | null
    lowestProject: NamedAmount | null
    assetValue: number
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
  return formatMoney(value)
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

const DELTA_CAP = 999.9

export function formatDelta(value: number): string {
  if (!Number.isFinite(value)) return "—"
  const capped = Math.abs(value) >= DELTA_CAP
  const shown = Math.min(Math.abs(value), DELTA_CAP)
  const sign = value > 0 ? "+" : value < 0 ? "−" : ""
  const bound = capped ? (value > 0 ? ">" : "<") : ""
  return `${bound}${sign}${shown.toFixed(1)}%`
}

export function formatRatio(value: number): string {
  const sign = value < 0 ? "−" : ""
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

// (Total Revenue − Accounts Receivable) / Total Revenue. Zero revenue is 0%.
export function collectionEfficiencyOf(revenue: number, receivables: number): number {
  return percentOf(revenue - receivables, revenue)
}

// Accounts receivable minus open vendor bills (accounts payable).
export function forecastedProfitOf(receivables: number, payables: number): number {
  return receivables - payables
}

export function projectExtremes(
  projects: {
    name: string
    totalValue: number
    year: number | null
    startedOn: string
  }[],
  scopeYear: number | null,
): { highest: NamedAmount | null; lowest: NamedAmount | null } {
  const scoped = projects.filter(
    (project) => scopeYear == null || projectYear(project) === scopeYear,
  )
  if (scoped.length === 0) return { highest: null, lowest: null }

  const ranked = [...scoped].sort(
    (left, right) =>
      left.totalValue - right.totalValue ||
      left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
  )
  const lowest = ranked[0]
  const highest = ranked[ranked.length - 1]
  if (!lowest || !highest) return { highest: null, lowest: null }

  return {
    lowest: { name: lowest.name, value: lowest.totalValue },
    highest: { name: highest.name, value: highest.totalValue },
  }
}

export function scopedBacklogValue(
  projects: { id: string; year: number | null; startedOn: string }[],
  backlogs: { projectId: string; amount: number }[],
  scopeYear: number | null,
): number {
  const inScope = new Set(
    projects
      .filter((project) => scopeYear == null || projectYear(project) === scopeYear)
      .map((project) => project.id),
  )
  const total = backlogs.reduce(
    (sum, row) => (inScope.has(row.projectId) ? sum + row.amount : sum),
    0,
  )
  return Math.round(total * 100) / 100
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

export function dashboardYears(currentYear: number): number[] {
  const years: number[] = []
  for (let year = currentYear; year >= DASHBOARD_FIRST_YEAR; year -= 1) {
    years.push(year)
  }
  return years
}

export function buildDashboard(
  input: DashboardInput,
  now: Date,
  scopeYear: number | null = null,
): DashboardModel {
  const today = dhakaToday(now)
  const currentYear = Number(today.slice(0, 4))
  const scoped = scopeYear != null
  const windowStart = scoped ? `${scopeYear}-01-01` : "0001-01-01"
  const windowEnd = !scoped || scopeYear === currentYear ? today : `${scopeYear}-12-31`
  const asOfToday = !scoped || scopeYear === currentYear

  const rawRevenue = dated(input.revenue)
  const rawVendorPayments = dated(input.vendorPayments)
  const rawOperational = dated(input.operational)
  const rawTaxes = dated(input.taxes)
  const rawBank = dated(input.bank)

  const revenue = rawRevenue.filter((row) => row.date <= today)
  const vendorPayments = rawVendorPayments.filter((row) => row.date <= today)
  const operational = rawOperational.filter((row) => row.date <= today)
  const taxes = rawTaxes.filter((row) => row.date <= today)
  const bank = rawBank.filter((row) => row.date <= today)

  const books: Books = {
    revenue,
    vendorPayments,
    operational,
    taxes,
    bank,
    collectionRate: ledgerCollectionRate(input, windowStart, windowEnd, !scoped),
  }
  const windowBooks = clipBooks(books, windowStart, windowEnd)
  const snapshot = scoped
    ? buildYear(scopeYear, today, currentYear, books)
    : buildSpan(currentYear, windowEnd, books)

  const receivables = receivablesAsOf(input, windowEnd, asOfToday)
  const payables = payablesAsOf(input, windowEnd, asOfToday)

  const cashBalance = balanceAsOf(bank, windowEnd, input.openingBalance)
  const cashDelta = changePercent(
    cashBalance,
    balanceAsOf(bank, previousMonthEnd(windowEnd), input.openingBalance),
  )

  const projects = input.projects.filter(
    (project) => !scoped || projectYear(project) === scopeYear,
  )
  const leads = input.leads.filter(
    (lead) => !scoped || inSpan(lead.addedOn, windowStart, windowEnd),
  )
  const clientCount =
    input.clients.length > 0
      ? input.clients.filter(
          (client) => !scoped || inSpan(client.createdOn, windowStart, windowEnd),
        ).length
      : scoped
        ? 0
        : input.clientCount
  const backlogCount = scoped
    ? input.backlogYears.filter((year) => year === scopeYear).length
    : input.backlogCount
  const windowRevenue = totalBetween(revenue, windowStart, windowEnd)
  const won = leads.filter((lead) => lead.status === "won").length
  const lost = leads.filter((lead) => lead.status === "lost").length
  const projectYears = projects
    .map((project) => projectYear(project))
    .filter((year): year is number => year != null)

  const latestWeek = isoWeek(windowEnd)
  const weeks = lastWeeks(windowEnd, 12, windowBooks)
  const annualYears = chartYears(input, currentYear)
  const annual = scoped
    ? monthSpark(scopeYear, scopeYear === currentYear ? today : windowEnd, (start, end) =>
        grossBetween(revenue, vendorPayments, operational, taxes, start, end),
      ).map((point) => ({ label: point.label, grossProfit: point.value }))
    : annualYears.map((year) => ({
        label: `FY${year}`,
        grossProfit: grossBetween(
          revenue,
          vendorPayments,
          operational,
          taxes,
          `${year}-01-01`,
          year === currentYear ? today : `${year}-12-31`,
        ),
      }))
  const trend = scoped
    ? monthSpark(scopeYear, scopeYear === currentYear ? today : windowEnd, (start, end) =>
        projects.filter((project) => inSpan(project.startedOn, start, end)).length,
      ).map((point) => ({ label: point.label, count: point.value }))
    : annualYears.map((year) => ({
        label: String(year),
        count: input.projects.filter((project) => projectYear(project) === year).length,
      }))

  const launch = normalizeLaunchDate(input.launchDate)
  const tenureStart = scoped
    ? launch > windowStart
      ? launch
      : windowStart
    : launch <= today
      ? launch
      : today
  const tenureEnd = windowEnd
  const tenureSpan =
    tenureStart <= tenureEnd ? calendarSpan(tenureStart, tenureEnd) : emptySpan()
  // Launch day itself is a full day of operation, so a same-day span still divides by 1.
  const operatingDays = tenureStart <= tenureEnd ? Math.max(tenureSpan.totalDays, 1) : 0
  const windowNet = snapshot.netProfit

  return {
    updatedLabel: formatUpdatedAt(now),
    updatedIso: now.toISOString(),
    scopeYear: scoped ? scopeYear : null,
    scopeLabel: scoped ? `FY${scopeYear}` : "All Time",
    defaultYear: scoped ? scopeYear : currentYear,
    years: dashboardYears(currentYear),
    snapshots: [snapshot],
    cashBalance,
    cashDelta,
    cashSpark: scoped
      ? monthEnds(scopeYear, windowEnd, bank, input.openingBalance)
      : annualYears.map((year) => ({
          label: String(year),
          value: balanceAsOf(
            bank,
            year === currentYear ? today : `${year}-12-31`,
            input.openingBalance,
          ),
        })),
    receivables,
    payables,
    forecastedProfit: forecastedProfitOf(receivables, payables),
    weeks,
    weekCaption: presentWeekCaption(latestWeek.start, latestWeek.end, latestWeek.week),
    annual,
    annualCaption: presentAnnualCaption(
      annualYears[0] ?? currentYear,
      annualYears[annualYears.length - 1] ?? currentYear,
      currentYear,
      scoped,
      scoped ? scopeYear : null,
    ),
    trend,
    trendCaption: `${scoped ? projects.length : input.projects.length} Total`,
    performance: {
      projectCount: projects.length,
      sinceYear: scoped
        ? projects.length > 0
          ? scopeYear
          : null
        : projectYears.length > 0
          ? Math.min(...projectYears)
          : null,
      active: projects.filter((project) => project.status === "active").length,
      openLeads: leads.filter((lead) => lead.isOpen).length,
      clients: clientCount,
      leadValue: leads
        .filter((lead) => lead.isOpen)
        .reduce((total, lead) => total + lead.estimatedValue, 0),
      // Won leads divided by won + lost. Open, on hold, and cancelled leads are not decided.
      winRate: percentOf(won, won + lost),
      collectionEfficiency: collectionEfficiencyOf(windowRevenue, receivables),
      // project_backlogs: spend already above collections, not a not-started phase.
      backlog: backlogCount,
      backlogValue: 0,
      highestProject: null,
      lowestProject: null,
      assetValue: 0,
    },
    tenure: {
      launchDateLabel: formatDayMonYear(launch),
      inOperation: formatOperation(tenureSpan),
      daysLabel: scoped
        ? `${formatGroupedCount(operatingDays)} Days In ${scopeYear}`
        : `${formatGroupedCount(tenureSpan.totalDays)} Days Since Launch`,
      revenuePerDay: operatingDays > 0 ? Math.round(windowRevenue / operatingDays) : 0,
      netProfitPerDay: operatingDays > 0 ? Math.round(windowNet / operatingDays) : 0,
    },
  }
}

export function presentWeekCaption(start: string, end: string, week: number): string {
  return `${formatRange(start, end)} (W${week}) · Last 12 Weeks`
}

export function presentAnnualCaption(
  first: number,
  last: number,
  currentYear: number,
  monthly: boolean,
  scopeYear: number | null,
): string {
  if (monthly && scopeYear != null) {
    return `Gross Profit FY${scopeYear}${scopeYear === currentYear ? " (YTD)" : ""}`
  }
  const years = first === last ? [first] : [first, last]
  return annualCaption(years, currentYear)
}

export function presentTenure(input: {
  launch: string
  spanStart: string
  spanEnd: string
  scoped: boolean
  scopeYear: number | null
  revenuePerDay: number
  netProfitPerDay: number
}): DashboardModel["tenure"] {
  const launch = normalizeLaunchDate(input.launch)
  const span =
    input.spanStart <= input.spanEnd
      ? calendarSpan(input.spanStart, input.spanEnd)
      : emptySpan()
  const operatingDays =
    input.spanStart <= input.spanEnd ? Math.max(span.totalDays, 1) : 0
  return {
    launchDateLabel: formatDayMonYear(launch),
    inOperation: formatOperation(span),
    daysLabel: input.scoped
      ? `${formatGroupedCount(operatingDays)} Days In ${input.scopeYear}`
      : `${formatGroupedCount(span.totalDays)} Days Since Launch`,
    revenuePerDay: input.revenuePerDay,
    netProfitPerDay: input.netProfitPerDay,
  }
}

export function parseDashboardYear(
  value: string | undefined,
  currentYear: number,
): number | null {
  if (value == null || value === "" || value === "all") return null
  const year = Number(value)
  if (!Number.isInteger(year) || year < DASHBOARD_FIRST_YEAR || year > currentYear) {
    return currentYear
  }
  return year
}

function annualCaption(years: number[], currentYear: number): string {
  const firstAnnual = years[0] ?? currentYear
  const lastAnnual = years[years.length - 1] ?? currentYear
  if (firstAnnual === lastAnnual) {
    return `Gross Profit FY${firstAnnual}${lastAnnual === currentYear ? " (FY" + currentYear + " YTD)" : ""}`
  }
  return `Gross Profit FY${firstAnnual} – FY${lastAnnual}${lastAnnual === currentYear ? " (FY" + currentYear + " YTD)" : ""}`
}

function chartYears(input: DashboardInput, currentYear: number): number[] {
  let first = DASHBOARD_FIRST_YEAR
  for (const project of input.projects) {
    const year = projectYear(project)
    if (year != null && year < first) first = year
  }
  const years: number[] = []
  for (let year = first; year <= currentYear; year += 1) years.push(year)
  return years
}

function clipBooks(books: Books, start: string, end: string): Books {
  return {
    revenue: books.revenue.filter((row) => inSpan(row.date, start, end)),
    vendorPayments: books.vendorPayments.filter((row) => inSpan(row.date, start, end)),
    operational: books.operational.filter((row) => inSpan(row.date, start, end)),
    taxes: books.taxes.filter((row) => inSpan(row.date, start, end)),
    bank: books.bank.filter((row) => inSpan(row.date, start, end)),
    collectionRate: books.collectionRate,
  }
}

function buildSpan(year: number, end: string, books: Books): YearSnapshot {
  const start = "0001-01-01"
  const expenses = expenseTotals(books, start, end)
  const revenue = totalBetween(books.revenue, start, end)
  const grossProfit = grossProfitOf(revenue, expenses)
  const netProfit = netProfitOf(revenue, expenses)
  const projectExpense = projectExpenseOf(expenses)
  const withdrawal = totalWithdrawals(books.bank, start, end)
  const currentYear = Number(end.slice(0, 4))
  return {
    year,
    revenue,
    revenueDelta: null,
    grossProfit,
    grossDelta: null,
    netProfit,
    netDelta: null,
    totalExpense: expenses.total,
    expenseDelta: null,
    withdrawal,
    material: expenses.material,
    subcontractor: expenses.subcontractor,
    projectOverhead: expenses.projectOverhead,
    tax: expenses.tax,
    admin: expenses.admin,
    operational: expenses.operational,
    marketing: expenses.marketing,
    salary: expenses.salary,
    projectExpense,
    collectionRate: books.collectionRate,
    expenseRatio: percentOf(expenses.total, revenue),
    grossMargin: percentOf(grossProfit, revenue),
    netMargin: percentOf(netProfit, revenue),
    withdrawalRatio: percentOf(withdrawal, revenue),
    projectCostRatio: percentOf(projectExpense, expenses.total),
    taxRatio: percentOf(expenses.tax, revenue),
    adminRatio: percentOf(adminExpenseOf(expenses), revenue),
    revenueSpark: yearSpark(start, end, currentYear, (from, to) =>
      totalBetween(books.revenue, from, to),
    ),
    grossSpark: yearSpark(start, end, currentYear, (from, to) =>
      grossProfitOf(totalBetween(books.revenue, from, to), expenseTotals(books, from, to)),
    ),
    netSpark: yearSpark(start, end, currentYear, (from, to) =>
      netProfitOf(totalBetween(books.revenue, from, to), expenseTotals(books, from, to)),
    ),
    expenseSpark: yearSpark(start, end, currentYear, (from, to) => expenseTotals(books, from, to).total),
  }
}

function yearSpark(
  start: string,
  end: string,
  currentYear: number,
  valueFor: (start: string, end: string) => number,
): ChartPoint[] {
  const first = Math.max(DASHBOARD_FIRST_YEAR, Number(start.slice(0, 4)) || DASHBOARD_FIRST_YEAR)
  const last = Number(end.slice(0, 4))
  const points: ChartPoint[] = []
  for (let year = first; year <= last; year += 1) {
    const yearEnd = year === currentYear ? end : `${year}-12-31`
    points.push({
      label: String(year),
      value: valueFor(`${year}-01-01`, yearEnd),
    })
  }
  return points
}

function emptySpan() {
  return { years: 0, months: 0, days: 0, totalDays: 0 }
}

function ledgerCollectionRate(
  input: DashboardInput,
  start: string,
  end: string,
  allTime: boolean,
): number {
  if (allTime || input.invoices.length === 0) {
    return percentOf(input.ledgerPaid, input.billed)
  }
  let billed = 0
  let paid = 0
  for (const invoice of input.invoices) {
    if (invoice.voided || !inSpan(invoice.issuedOn, start, end)) continue
    billed += invoice.amount
  }
  for (const invoice of input.invoices) {
    if (invoice.voided) continue
    for (const payment of invoice.payments) {
      if (inSpan(payment.date, start, end)) paid += payment.amount
    }
  }
  return percentOf(paid, billed)
}

function receivablesAsOf(input: DashboardInput, asOf: string, countEveryPayment: boolean): number {
  if (input.invoices.length === 0) return input.receivables
  let total = 0
  for (const invoice of input.invoices) {
    if (invoice.voided || invoice.issuedOn > asOf) continue
    const paid = invoice.payments.reduce((sum, payment) => {
      if (!countEveryPayment && payment.date > asOf) return sum
      return sum + payment.amount
    }, 0)
    total += Math.max(invoice.amount - paid, 0)
  }
  return total
}

function payablesAsOf(input: DashboardInput, asOf: string, countEveryPayment: boolean): number {
  if (input.orders.length === 0) return input.payables
  let total = 0
  for (const order of input.orders) {
    if (!order.projectLinked || order.issuedOn > asOf) continue
    const paid = order.payments.reduce((sum, payment) => {
      if (!countEveryPayment && payment.date > asOf) return sum
      return sum + payment.amount
    }, 0)
    total += Math.max(order.totalValue - paid, 0)
  }
  return total
}

type Books = {
  revenue: Dated[]
  vendorPayments: (Dated & {
    workType: string | null
    expenseCategory: string | null
    officeCategory: string | null
    projectLinked: boolean
  })[]
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
  const grossProfit = grossProfitOf(revenue, expenses)
  const priorGross = grossProfitOf(priorRevenue, priorExpenses)
  const netProfit = netProfitOf(revenue, expenses)
  const priorNet = netProfitOf(priorRevenue, priorExpenses)
  const projectExpense = projectExpenseOf(expenses)
  const withdrawal = totalWithdrawals(books.bank, current.start, current.end)

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
    withdrawal,
    material: expenses.material,
    subcontractor: expenses.subcontractor,
    projectOverhead: expenses.projectOverhead,
    tax: expenses.tax,
    admin: expenses.admin,
    operational: expenses.operational,
    marketing: expenses.marketing,
    salary: expenses.salary,
    projectExpense,
    // Whole receivable ledger. Invoice dates do not make a clean fiscal cut of this rate.
    collectionRate: books.collectionRate,
    expenseRatio: percentOf(expenses.total, revenue),
    grossMargin: percentOf(grossProfit, revenue),
    netMargin: percentOf(netProfit, revenue),
    withdrawalRatio: percentOf(withdrawal, revenue),
    projectCostRatio: percentOf(projectExpense, expenses.total),
    taxRatio: percentOf(expenses.tax, revenue),
    adminRatio: percentOf(adminExpenseOf(expenses), revenue),
    revenueSpark: monthSpark(year, today, (start, end) =>
      totalBetween(books.revenue, start, end),
    ),
    grossSpark: monthSpark(year, today, (start, end) =>
      grossProfitOf(totalBetween(books.revenue, start, end), expenseTotals(books, start, end)),
    ),
    netSpark: monthSpark(year, today, (start, end) =>
      netProfitOf(totalBetween(books.revenue, start, end), expenseTotals(books, start, end)),
    ),
    expenseSpark: monthSpark(year, today, (start, end) => expenseTotals(books, start, end).total),
  }
}

type ExpenseTotals = {
  material: number
  subcontractor: number
  projectOverhead: number
  tax: number
  admin: number
  operational: number
  marketing: number
  salary: number
  total: number
}

function projectExpenseOf(expenses: ExpenseTotals): number {
  return expenses.material + expenses.subcontractor + expenses.projectOverhead
}

function adminExpenseOf(expenses: ExpenseTotals): number {
  // Non-project operational cost, marketing, salary, and the admin category.
  // Project-linked costs and VAT/Tax records are not in these buckets.
  return expenses.operational + expenses.marketing + expenses.salary + expenses.admin
}

function grossProfitOf(revenue: number, expenses: ExpenseTotals): number {
  // Project revenue is client collections. Every client invoice belongs to a project.
  // Project expense is project-linked cost. Tax is the VAT/Tax ledger, counted only here.
  return revenue - projectExpenseOf(expenses) - expenses.tax
}

function netProfitOf(revenue: number, expenses: ExpenseTotals): number {
  return grossProfitOf(revenue, expenses) - adminExpenseOf(expenses)
}

function expenseTotals(books: Books, start: string, end: string): ExpenseTotals {
  const totals: ExpenseTotals = {
    material: 0,
    subcontractor: 0,
    projectOverhead: 0,
    tax: 0,
    admin: 0,
    operational: 0,
    marketing: 0,
    salary: 0,
    total: 0,
  }

  for (const row of books.vendorPayments) {
    if (!inSpan(row.date, start, end)) continue
    // Operational purchase orders have no project. Their payments stay out of
    // material, subcontractor, and project expense. The office category, then
    // the work type, then Operational, chooses Admin, Salary, Marketing, or Operational.
    if (!row.projectLinked) {
      const category =
        row.officeCategory?.trim() || row.workType?.trim() || "Operational"
      totals[classifyOperational(category)] += row.amount
      continue
    }
    // A project payment whose purchase order has an expense category counts as
    // Material Cost when that name contains material, supply, or goods. Otherwise
    // it is Subcontractor Cost. With no category, the work type decides the same way.
    const bucket = isMaterialCost(row.expenseCategory, row.workType)
      ? "material"
      : "subcontractor"
    totals[bucket] += row.amount
  }

  for (const row of books.operational) {
    if (!inSpan(row.date, start, end)) continue
    // A project-linked operational row is a project cost. It is not also
    // operational expense, salary, admin, or marketing.
    if (row.projectLinked) {
      totals.projectOverhead += row.amount
      continue
    }
    totals[classifyOperational(row.category)] += row.amount
  }

  for (const row of books.taxes) {
    if (!inSpan(row.date, start, end)) continue
    totals.tax += row.amount
  }

  for (const row of books.bank) {
    if (row.sourceKind !== "payroll" || row.direction !== "outflow") continue
    if (!inSpan(row.date, start, end)) continue
    // Employee Salary is payroll outflows on the bank ledger, plus operational
    // rows categorized as salary that are not linked to a project.
    totals.salary += row.amount
  }

  totals.total =
    totals.material +
    totals.subcontractor +
    totals.projectOverhead +
    totals.tax +
    totals.admin +
    totals.operational +
    totals.marketing +
    totals.salary
  return totals
}

function grossBetween(
  revenue: Dated[],
  vendorPayments: (Dated & {
    workType: string | null
    expenseCategory: string | null
    officeCategory: string | null
    projectLinked: boolean
  })[],
  operational: (Dated & { category: string; projectLinked: boolean })[],
  taxes: Dated[],
  start: string,
  end: string,
): number {
  const collected = totalBetween(revenue, start, end)
  const expenses = expenseTotals(
    {
      revenue,
      vendorPayments,
      operational,
      taxes,
      bank: [],
      collectionRate: 0,
    },
    start,
    end,
  )
  return grossProfitOf(collected, expenses)
}

export function isMaterialWork(workType: string | null): boolean {
  const name = (workType ?? "").toLowerCase()
  return name.includes("material") || name.includes("supply") || name.includes("goods")
}

export function isMaterialCost(
  categoryName: string | null | undefined,
  workType: string | null | undefined,
): boolean {
  const category = categoryName?.trim() ?? ""
  if (category) return isMaterialWork(category)
  return isMaterialWork(workType ?? null)
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
      projectExpense: projectExpenseOf(expenses),
      adminExpense: adminExpenseOf(expenses),
      totalExpense: expenses.total,
      netProfit: netProfitOf(weekRevenue, expenses),
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

function totalWithdrawals(
  bank: (Dated & { direction: string; sourceKind: string })[],
  start: string,
  end: string,
): number {
  // Manual withdrawals from Banking. Deposits, transfers, and payment outflows stay out.
  let total = 0
  for (const row of bank) {
    if (row.sourceKind !== "withdrawal" || row.direction !== "outflow") continue
    if (!inSpan(row.date, start, end)) continue
    total += row.amount
  }
  return total
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

function inSpan(date: string, start: string, end: string): boolean {
  return date >= start && date <= end
}

function percentOf(part: number, whole: number): number {
  // Zero revenue, and any other zero denominator, is 0% rather than an infinite ratio.
  if (whole === 0) return 0
  return (part / whole) * 100
}

function changePercent(current: number, prior: number): number | null {
  if (prior === 0) return null
  const raw = ((current - prior) / Math.abs(prior)) * 100
  if (raw > DELTA_CAP) return DELTA_CAP
  if (raw < -DELTA_CAP) return -DELTA_CAP
  return raw
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
