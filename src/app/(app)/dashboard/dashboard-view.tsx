"use client"

import { useState } from "react"
import {
  AlertCircle,
  BadgeCheck,
  Clock,
  Download,
  Gem,
  Hammer,
  Layers,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react"

import {
  AnnualChart,
  ExpenseDonut,
  expenseSliceStyle,
  Sparkline,
  TrendChart,
  WeeklyChart,
} from "@/app/(app)/dashboard/dashboard-charts"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatCompactBdt,
  formatCompactParts,
  formatDelta,
  formatExactBdt,
  formatRatio,
  formatShare,
  HIGH_VALUE_PROJECT_MIN,
  weekTrend,
  type DashboardModel,
  type YearSnapshot,
} from "@/lib/dashboard-metrics"
import { cn } from "@/lib/utils"

export function DashboardView({
  model,
  error,
}: {
  model: DashboardModel | null
  error: string | null
}) {
  if (!model) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
        <p role="alert" className="text-sm text-destructive">
          {error ?? "Could not load the dashboard."}
        </p>
      </div>
    )
  }

  return <DashboardSections model={model} />
}

function DashboardSections({ model }: { model: DashboardModel }) {
  const [year, setYear] = useState(model.defaultYear)
  const snapshot =
    model.snapshots.find((item) => item.year === year) ?? model.snapshots[0]
  const yearItems = model.years.map((item) => ({
    value: String(item),
    label: `FY${item}`,
  }))

  if (!snapshot) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">No Records Yet</p>
      </div>
    )
  }

  const slices = expenseSliceStyle.map((slice) => ({
    ...slice,
    amount: snapshot[slice.key],
  }))
  const previousWeek = model.weeks[model.weeks.length - 2]
  const latestWeek = model.weeks[model.weeks.length - 1]

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Last Updated{" "}
            <time dateTime={model.updatedIso}>{model.updatedLabel}</time>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            items={yearItems}
            value={String(snapshot.year)}
            onValueChange={(value) => {
              if (value) setYear(Number(value))
            }}
          >
            <SelectTrigger aria-label="Fiscal Year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {yearItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={() => downloadDashboard(model, snapshot)}>
            <Download aria-hidden="true" />
            Export
          </Button>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <h2 className="sr-only">Financial Overview</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Total Revenue"
            value={snapshot.revenue}
            delta={snapshot.revenueDelta}
            spark={snapshot.revenueSpark}
            sparkColor="var(--chart-1)"
          />
          <KpiCard
            label="Net Profit"
            value={snapshot.netProfit}
            delta={snapshot.netDelta}
            spark={snapshot.netSpark}
            sparkColor="var(--chart-1)"
          />
          <KpiCard
            label="Cash Balance"
            value={model.cashBalance}
            detail="Current"
            delta={model.cashDelta}
            spark={model.cashSpark}
            sparkColor="var(--chart-4)"
          />
          <KpiCard
            label="Gross Profit"
            value={snapshot.grossProfit}
            delta={snapshot.grossDelta}
            spark={snapshot.grossSpark}
            sparkColor="var(--chart-1)"
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <CompactMetric
            label="Total Expense"
            value={snapshot.totalExpense}
            detail={
              snapshot.expenseDelta == null
                ? formatExactBdt(snapshot.totalExpense)
                : `${formatExactBdt(snapshot.totalExpense)} · ${formatDelta(snapshot.expenseDelta)} Vs Last FY`
            }
          />
          <CompactMetric
            label="Accounts Receivables"
            value={model.receivables}
            detail={`${formatExactBdt(model.receivables)} · Current`}
          />
          <CompactMetric
            label="Accounts Payables"
            value={model.payables}
            detail={`${formatExactBdt(model.payables)} · Current`}
            icon={model.payables > 0 ? AlertCircle : undefined}
          />
          <CompactMetric
            label="Forecasted Profit"
            value={model.forecastedProfit}
            detail={`${formatExactBdt(model.forecastedProfit)} · After Open Balances`}
            tone={model.forecastedProfit < 0 ? "negative" : "default"}
            icon={model.forecastedProfit < 0 ? TrendingDown : TrendingUp}
          />
          <CompactMetric
            label="Outflow"
            value={snapshot.outflow}
            detail={formatExactBdt(snapshot.outflow)}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-medium">Weekly Financial Overview</h2>
                <p className="text-sm text-muted-foreground">{model.weekCaption}</p>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <LegendDot className="bg-chart-1" label="Revenue" />
                <LegendDot className="bg-chart-4" label="Total Expense" />
                <LegendDot className="bg-chart-2" label="Net Profit" />
              </div>
            </div>
            {latestWeek ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <WeekStat
                  label="Weekly Revenue"
                  value={latestWeek.revenue}
                  direction={weekTrend(latestWeek.revenue, previousWeek?.revenue)}
                  tone="good"
                />
                <WeekStat
                  label="Weekly Project Expense"
                  value={latestWeek.projectExpense}
                  direction={weekTrend(latestWeek.projectExpense, previousWeek?.projectExpense)}
                  tone="cost"
                />
                <WeekStat
                  label="Weekly Admin Expense"
                  value={latestWeek.adminExpense}
                  direction={weekTrend(latestWeek.adminExpense, previousWeek?.adminExpense)}
                  tone="cost"
                />
                <WeekStat
                  label="Weekly Total Expense"
                  value={latestWeek.totalExpense}
                  direction={weekTrend(latestWeek.totalExpense, previousWeek?.totalExpense)}
                  tone="cost"
                />
                <WeekStat
                  label="Weekly Net Profit"
                  value={latestWeek.netProfit}
                  direction={weekTrend(latestWeek.netProfit, previousWeek?.netProfit)}
                  tone="good"
                  emphasize
                />
              </div>
            ) : null}
            <WeeklyChart
              data={model.weeks.map((week) => ({
                label: week.label,
                revenue: week.revenue,
                totalExpense: week.totalExpense,
                netProfit: week.netProfit,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4">
            <h2 className="text-base font-medium">Expense Summary</h2>
            <div className="relative">
              <ExpenseDonut slices={slices} />
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-lg font-semibold tabular-nums">
                  {formatCompactBdt(snapshot.totalExpense)}
                </p>
                <p className="text-xs text-muted-foreground">Total Expense</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-2 text-sm">
                <span className="font-medium">Project Expense</span>
                <span className="font-semibold tabular-nums">
                  {formatCompactBdt(snapshot.projectExpense)}
                </span>
              </div>
              {slices.map((slice) => (
                <div key={slice.key} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <span className={cn("size-2 shrink-0 rounded-full", slice.swatch)} />
                    <span className="truncate">{slice.label}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 tabular-nums">
                    <span className="text-xs text-muted-foreground">
                      {formatShare(slice.amount, snapshot.totalExpense)}
                    </span>
                    <span className="min-w-16 text-right font-medium">
                      {formatCompactBdt(slice.amount)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-medium">Performance Metrics</h2>
              <p className="text-xs text-muted-foreground">
                {model.performance.sinceYear == null
                  ? "No Projects Yet"
                  : `${model.performance.projectCount} Projects Since ${model.performance.sinceYear}`}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <MetricTile
                icon={Gem}
                label="High-Value Projects"
                value={String(model.performance.highValue)}
                hint={`${formatExactBdt(HIGH_VALUE_PROJECT_MIN)} Or More`}
              />
              <MetricTile
                icon={Layers}
                label="Low-Value Projects"
                value={String(model.performance.lowValue)}
                hint={`Under ${formatExactBdt(HIGH_VALUE_PROJECT_MIN)}`}
              />
              <MetricTile
                icon={Hammer}
                label="Active Projects"
                value={String(model.performance.active)}
                hint="In Progress"
              />
              <MetricTile
                icon={Target}
                label="Projects in Leads"
                value={String(model.performance.openLeads)}
                hint="Open Pipeline"
              />
              <MetricTile
                icon={Users}
                label="Clients"
                value={String(model.performance.clients)}
                hint="Active Accounts"
              />
              <MetricTile
                icon={Wallet}
                label="Project Lead Value"
                value={formatCompactBdt(model.performance.leadValue)}
                hint={`${formatExactBdt(model.performance.leadValue)} In Pipeline`}
              />
              <MetricTile
                icon={Trophy}
                label="Win Rate"
                value={formatRatio(model.performance.winRate)}
                bar={model.performance.winRate}
              />
              <MetricTile
                icon={BadgeCheck}
                label="Collection Efficiency"
                value={formatRatio(model.performance.collectionEfficiency)}
                bar={model.performance.collectionEfficiency}
              />
              <MetricTile
                icon={Clock}
                label="Backlog Projects"
                value={String(model.performance.backlog)}
                hint="Expense Exceeds Collection"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-medium">Margin Analysis</h2>
              <p className="text-xs text-muted-foreground">FY{snapshot.year}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <Ring label="Collection Rate" value={snapshot.collectionRate} tone="text-chart-2" />
              <Ring label="Expense Ratio" value={snapshot.expenseRatio} tone="text-destructive" />
              <Ring
                label="Gross Profit Margin"
                value={snapshot.grossMargin}
                tone={snapshot.grossMargin < 0 ? "text-destructive" : "text-chart-1"}
              />
              <Ring label="Project Cost Ratio" value={snapshot.projectCostRatio} tone="text-chart-4" />
              <Ring label="Tax Ratio" value={snapshot.taxRatio} tone="text-chart-3" />
              <Ring label="Admin Expense Ratio" value={snapshot.adminRatio} tone="text-chart-5" />
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardContent className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-medium">Annual Gross Profit</h2>
              <p className="text-xs text-muted-foreground">{model.annualCaption}</p>
            </div>
            {model.annual.length > 0 ? (
              <AnnualChart data={model.annual} />
            ) : (
              <p className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                No Records Yet
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardContent className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-medium">Project Trend</h2>
              <p className="text-xs text-muted-foreground">
                Projects Per Year · {model.trendCaption}
              </p>
            </div>
            {model.trend.length > 0 ? (
              <TrendChart data={model.trend} />
            ) : (
              <p className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                No Records Yet
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="xl:col-span-3">
          <CardContent className="flex h-full flex-col justify-between gap-6">
            <div className="flex flex-col gap-4">
              <h2 className="text-base font-medium">Operational Tenure</h2>
              <div>
                <p className="text-xs text-muted-foreground">Launch Date</p>
                <p className="text-sm font-medium">{model.tenure.launchDateLabel}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">In Operation</p>
                <p className="text-base font-semibold text-primary">{model.tenure.inOperation}</p>
                <p className="text-xs text-muted-foreground">{model.tenure.daysLabel}</p>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Revenue Per Day</p>
                <p className="text-sm font-semibold tabular-nums">
                  {formatExactBdt(model.tenure.revenuePerDay)}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Net Profit Per Day</p>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    model.tenure.netProfitPerDay < 0 ? "text-destructive" : "text-primary",
                  )}
                >
                  {formatExactBdt(model.tenure.netProfitPerDay)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

function KpiCard({
  label,
  value,
  detail,
  delta,
  spark,
  sparkColor,
}: {
  label: string
  value: number
  detail?: string
  delta: number | null
  spark: { label: string; value: number }[]
  sparkColor: string
}) {
  const parts = formatCompactParts(value)
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {delta != null ? <DeltaBadge value={delta} /> : null}
        </div>
        <p
          className={cn(
            "text-2xl font-semibold tabular-nums",
            value < 0 && "text-destructive",
          )}
        >
          {parts.text}
          {parts.unit ? (
            <span className="text-lg font-medium"> {parts.unit}</span>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {detail ? `${formatExactBdt(value)} · ${detail}` : formatExactBdt(value)}
        </p>
        <Sparkline data={spark} color={sparkColor} />
      </CardContent>
    </Card>
  )
}

function CompactMetric({
  label,
  value,
  detail,
  tone = "default",
  icon: Icon,
}: {
  label: string
  value: number
  detail: string
  tone?: "default" | "negative"
  icon?: LucideIcon
}) {
  return (
    <Card className={tone === "negative" ? "bg-destructive/5" : undefined}>
      <CardContent className="flex flex-col justify-center gap-1">
        <p
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            tone === "negative" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
          {label}
        </p>
        <p
          className={cn(
            "text-lg font-semibold tabular-nums",
            tone === "negative" || value < 0 ? "text-destructive" : "text-foreground",
          )}
        >
          {formatCompactBdt(value)}
        </p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

function MetricTile({
  icon: Icon,
  label,
  value,
  hint,
  bar,
}: {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  bar?: number
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums leading-tight">{value}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
        {bar != null ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Ring({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: string
}) {
  const arc = Math.max(0, Math.min(100, value))
  return (
    <div className="flex flex-col items-center" aria-label={`${label} ${formatRatio(value)}`}>
      <div className="relative flex size-20 items-center justify-center">
        <svg className={cn("size-full -rotate-90", tone)} viewBox="0 0 36 36" aria-hidden="true">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            className="stroke-border"
            strokeWidth="3.2"
          />
          {arc > 0 ? (
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              className="stroke-current"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeDasharray={`${arc} 100`}
            />
          ) : null}
        </svg>
        <span className="absolute text-xs font-semibold tabular-nums">{formatRatio(value)}</span>
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">{label}</p>
    </div>
  )
}

function WeekStat({
  label,
  value,
  direction,
  tone,
  emphasize = false,
}: {
  label: string
  value: number
  direction: "up" | "down" | "flat"
  tone: "good" | "cost"
  emphasize?: boolean
}) {
  return (
    <div className="min-w-0">
      <p className="min-h-8 text-xs leading-snug text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 flex items-center gap-1 text-sm font-semibold tabular-nums",
          emphasize && (value < 0 ? "text-destructive" : "text-primary"),
        )}
      >
        {formatCompactBdt(value)}
        <TrendMark direction={direction} tone={tone} />
      </p>
    </div>
  )
}

function TrendMark({
  direction,
  tone,
}: {
  direction: "up" | "down" | "flat"
  tone: "good" | "cost"
}) {
  if (direction === "flat") {
    return <Minus aria-hidden="true" className="size-4 text-muted-foreground" />
  }
  const improved = tone === "good" ? direction === "up" : direction === "down"
  const Icon = direction === "up" ? TrendingUp : TrendingDown
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-4", improved ? "text-primary" : "text-destructive")}
    />
  )
}

function DeltaBadge({ value }: { value: number }) {
  const rising = value > 0
  const Icon = rising ? TrendingUp : value < 0 ? TrendingDown : Minus
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        rising ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      {formatDelta(value)}
    </span>
  )
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2.5 rounded-full", className)} />
      {label}
    </span>
  )
}

function downloadDashboard(model: DashboardModel, snapshot: YearSnapshot) {
  const rows: (string | number)[][] = [
    ["Dashboard", "DSA ERP"],
    ["Fiscal Year", `FY${snapshot.year}`],
    ["Last Updated", model.updatedLabel],
    [],
    ["Metric", "Amount"],
    ["Total Revenue", snapshot.revenue],
    ["Total Expense", snapshot.totalExpense],
    ["Gross Profit", snapshot.grossProfit],
    ["Net Profit", snapshot.netProfit],
    ["Cash Balance", model.cashBalance],
    ["Accounts Receivables", model.receivables],
    ["Accounts Payables", model.payables],
    ["Forecasted Profit", model.forecastedProfit],
    ["Outflow", snapshot.outflow],
    ["Project Expense", snapshot.projectExpense],
    ["Material Cost", snapshot.material],
    ["Subcontractor Cost", snapshot.subcontractor],
    ["Tax Paid", snapshot.tax],
    ["Admin Expense", snapshot.admin],
    ["Operational Expense", snapshot.operational],
    ["Marketing", snapshot.marketing],
    ["Employee Salary", snapshot.salary],
    ["Collection Rate", snapshot.collectionRate],
    ["Expense Ratio", snapshot.expenseRatio],
    ["Gross Profit Margin", snapshot.grossMargin],
    ["Project Cost Ratio", snapshot.projectCostRatio],
    ["Tax Ratio", snapshot.taxRatio],
    ["Admin Expense Ratio", snapshot.adminRatio],
    ["High-Value Projects", model.performance.highValue],
    ["Low-Value Projects", model.performance.lowValue],
    ["Active Projects", model.performance.active],
    ["Projects in Leads", model.performance.openLeads],
    ["Clients", model.performance.clients],
    ["Project Lead Value", model.performance.leadValue],
    ["Win Rate", model.performance.winRate],
    ["Collection Efficiency", model.performance.collectionEfficiency],
    ["Backlog Projects", model.performance.backlog],
    ["Launch Date", model.tenure.launchDateLabel],
    ["In Operation", model.tenure.inOperation],
    ["Revenue Per Day", model.tenure.revenuePerDay],
    ["Net Profit Per Day", model.tenure.netProfitPerDay],
  ]
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\r\n")
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `dsa-erp-dashboard-fy${snapshot.year}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
