"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { type ReactNode } from "react"
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
  LegendDot,
  Ring,
  Sparkline,
  TrendChart,
  WeeklyChart,
} from "@/app/(app)/dashboard/dashboard-charts"
import { useAccess } from "@/components/access-provider"
import { Money } from "@/components/money"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { OverBudgetProject } from "@/lib/project-budget-model"
import {
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
  limited = false,
  overBudget = [],
}: {
  model: DashboardModel | null
  error: string | null
  limited?: boolean
  overBudget?: readonly OverBudgetProject[]
}) {
  if (limited) {
    return <LimitedDashboard />
  }

  if (!model) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-4">
        <DashboardChrome />
        <p role="alert" className="text-sm text-destructive">
          {error ?? "Could not load the dashboard."}
        </p>
      </div>
    )
  }

  return <DashboardSections model={model} overBudget={overBudget} />
}

function LimitedDashboard() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <DashboardChrome />
      <Card>
        <CardContent className="flex flex-col gap-2">
          <h2 className="text-panel-title font-bold md:font-strong">Financial Overview</h2>
          <p className="text-sm text-muted-foreground">
            Figures stay hidden unless this account can view every financial
            module and Show Financials is on.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function DashboardSections({
  model,
  overBudget,
}: {
  model: DashboardModel
  overBudget: readonly OverBudgetProject[]
}) {
  const showFinancials = useAccess().showFinancials
  const router = useRouter()
  if (!showFinancials) {
    return <LimitedDashboard />
  }
  const snapshot = model.snapshots[0]
  const yearValue = model.scopeYear == null ? "all" : String(model.scopeYear)
  const yearItems = [
    { value: "all", label: "All Time" },
    ...model.years.map((item) => ({
      value: String(item),
      label: `FY${item}`,
    })),
  ]
  const stockDetail =
    model.scopeYear == null || model.scopeYear === model.years[0]
      ? "Current"
      : `As Of ${model.scopeLabel}`

  if (!snapshot) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-4">
        <DashboardChrome updatedIso={model.updatedIso} updatedLabel={model.updatedLabel} />
        <Card>
          <CardContent>
            <p className="py-6 text-center text-callout text-muted-foreground md:text-sm">No Records Yet</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const slices = expenseSliceStyle.map((slice) => ({
    ...slice,
    amount: snapshot[slice.key],
  }))
  const previousWeek = model.weeks[model.weeks.length - 2]
  const latestWeek = model.weeks[model.weeks.length - 1]
  const performanceCaption =
    model.scopeYear == null
      ? model.performance.sinceYear == null
        ? "No Projects Yet"
        : `${model.performance.projectCount} Projects Since ${model.performance.sinceYear}`
      : `${model.performance.projectCount} Projects In ${model.scopeLabel}`

  return (
    <div className="flex w-full min-w-0 flex-col gap-2.5 md:gap-4">
      <DashboardChrome updatedIso={model.updatedIso} updatedLabel={model.updatedLabel}>
        <Select
          items={yearItems}
          value={yearValue}
          onValueChange={(value) => {
            if (!value || value === yearValue) return
            router.push(value === "all" ? "/dashboard?year=all" : `/dashboard?year=${value}`)
          }}
        >
          <SelectTrigger variant="capsule" aria-label="Fiscal Year">
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
        <Button type="button" variant="outline" onClick={() => downloadDashboard(model, snapshot, showFinancials)}>
          <Download aria-hidden="true" data-icon="inline-start" />
          Export
        </Button>
      </DashboardChrome>

      <section aria-label="Financial Overview" className="flex flex-col gap-2.5 md:gap-4">
        <div className="grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
          <KpiCard
            label="Total Revenue"
            value={snapshot.revenue}
            delta={snapshot.revenueDelta}
            spark={snapshot.revenueSpark}
            sparkColor="var(--chart-1)"
          />
          <KpiCard
            label="Total Expense"
            value={snapshot.totalExpense}
            delta={snapshot.expenseDelta}
            lowerIsBetter
            spark={snapshot.expenseSpark}
            sparkColor="var(--chart-3)"
          />
          <KpiCard
            label="Net Profit"
            value={snapshot.netProfit}
            delta={snapshot.netDelta}
            spark={snapshot.netSpark}
            sparkColor="var(--chart-2)"
          />
          {showFinancials ? (
            <KpiCard
              label="Cash Balance"
              value={model.cashBalance}
              detail={stockDetail}
              delta={model.cashDelta}
              spark={model.cashSpark}
              sparkColor="var(--chart-5)"
            />
          ) : null}
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-0 md:overflow-hidden md:rounded-card md:glass-panel xl:grid-cols-5">
          <CompactMetric
            label="Gross Profit"
            value={snapshot.grossProfit}
            detail={
              snapshot.grossDelta == null
                ? undefined
                : `${formatDelta(snapshot.grossDelta)} Vs Last FY`
            }
            tone={snapshot.grossProfit < 0 ? "negative" : "default"}
          />
          <CompactMetric
            label="Accounts Receivable"
            value={model.receivables}
            detail={stockDetail}
          />
          <CompactMetric
            label="Accounts Payable"
            value={model.payables}
            detail={stockDetail}
            tone={model.payables > 0 ? "warning" : "default"}
            icon={model.payables > 0 ? AlertCircle : undefined}
          />
          <CompactMetric
            label="Forecasted Profit"
            value={model.forecastedProfit}
            detail="After Open Balances"
            tone={model.forecastedProfit < 0 ? "negative" : "positive"}
            icon={model.forecastedProfit < 0 ? TrendingDown : TrendingUp}
          />
          <CompactMetric label="Withdrawal" value={snapshot.withdrawal} wide />
        </div>
      </section>

      <OverBudgetCard projects={overBudget} />

      <section
        aria-labelledby="performance-title"
        className="flex flex-col md:rounded-card md:px-6 md:py-5.5 md:glass-panel"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-0.5 px-1 pt-5.5 pb-2 md:mb-4 md:p-0">
          <h2 id="performance-title" className="text-section md:text-panel-title md:font-strong">
            Performance Metrics
          </h2>
          <p className="text-label text-muted-foreground md:text-caption">{performanceCaption}</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5 md:gap-3 lg:grid-cols-3">
          <MetricTile
            icon={Gem}
            color="bg-chart-1"
            label="High-Value Projects"
            value={String(model.performance.highValue)}
            hint={`${formatExactBdt(HIGH_VALUE_PROJECT_MIN)} Or More`}
          />
          <MetricTile
            icon={Layers}
            color="bg-chart-5"
            label="Low-Value Projects"
            value={String(model.performance.lowValue)}
            hint={`Under ${formatExactBdt(HIGH_VALUE_PROJECT_MIN)}`}
          />
          <MetricTile
            icon={Hammer}
            color="bg-chart-3"
            label="Active Projects"
            value={String(model.performance.active)}
            hint="In Progress"
          />
          <MetricTile
            icon={Target}
            color="bg-chart-6"
            label="Projects in Leads"
            value={String(model.performance.openLeads)}
            hint="Open Pipeline"
          />
          <MetricTile
            icon={Users}
            color="bg-chart-2"
            label="Clients"
            value={String(model.performance.clients)}
            hint="Active Accounts"
          />
          <MetricTile
            icon={Wallet}
            color="bg-chart-7"
            label="Project Lead Value"
            value={<Money value={model.performance.leadValue} />}
            hint="In Pipeline"
          />
          <MetricTile
            icon={Trophy}
            color="bg-chart-gold"
            label="Win Rate"
            value={formatRatio(model.performance.winRate)}
            bar={model.performance.winRate}
          />
          <MetricTile
            icon={BadgeCheck}
            color="bg-chart-9"
            label="Collection Efficiency"
            value={formatRatio(model.performance.collectionEfficiency)}
            bar={model.performance.collectionEfficiency}
          />
          <MetricTile
            icon={Clock}
            color="bg-chart-4"
            label="Backlog Projects"
            value={String(model.performance.backlog)}
            hint="Expense Exceeds Collection"
          />
        </div>
      </section>

      <section className="grid min-w-0 grid-cols-1 gap-2.5 md:gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
        <Panel
          title="Weekly Financial Overview"
          caption={model.weekCaption}
          aside={
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground md:gap-x-4 md:text-caption md:font-label">
              <LegendDot color="var(--chart-1)" label="Revenue" />
              <LegendDot color="var(--chart-3)" label="Total Expense" />
              <LegendDot color="var(--chart-2)" label="Net Profit" dashed />
            </div>
          }
          stackAside
        >
          <div className="flex flex-col gap-3 md:gap-3.5">
            {latestWeek ? (
              <div className="order-2 grid grid-cols-2 gap-2 md:order-1 md:grid-cols-3 xl:grid-cols-5">
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
            <div className="order-1 md:order-2">
              <WeeklyChart
                data={model.weeks.map((week) => ({
                  label: week.label,
                  revenue: week.revenue,
                  totalExpense: week.totalExpense,
                  netProfit: week.netProfit,
                }))}
              />
            </div>
          </div>
        </Panel>

        <Panel title="Expense Summary">
          <ExpenseDonut slices={slices}>
            <Money value={snapshot.totalExpense} size="kpi" className="text-callout font-bold tracking-[-0.02em] md:text-panel-title" />
            <span className="text-micro text-muted-foreground md:text-xs">Total Expense</span>
          </ExpenseDonut>
          <div className="mt-4 flex flex-col">
            <div className="mb-1 flex items-center justify-between gap-3 border-b border-border pb-2 text-sm font-bold md:mb-2 md:pb-2.25 md:text-label md:font-strong">
              <span>Project Expense</span>
              <Money value={snapshot.projectExpense} />
            </div>
            {slices.map((slice) => (
              <div key={slice.key} className="flex h-7.5 items-center justify-between gap-3 text-ui md:h-6.75 md:text-label">
                <span className="flex min-w-0 items-center gap-2 text-muted-foreground md:gap-2.25">
                  <span aria-hidden="true" className={cn("size-2.25 shrink-0 rounded-[3px]", slice.swatch)} />
                  <span className="truncate">{slice.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 md:gap-3">
                  <span className="text-xs text-subtle-foreground tabular-nums">
                    {formatShare(slice.amount, snapshot.totalExpense)}
                  </span>
                  <Money value={slice.amount} className="font-strong md:font-semibold" />
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <Panel
        title="Margin Analysis"
        aside={<Badge variant="outline">{model.scopeLabel}</Badge>}
      >
        <div className="grid grid-cols-4 gap-x-1.5 gap-y-3.5 md:gap-2 xl:grid-cols-8">
          <MarginRing label="Collection Rate" value={snapshot.collectionRate} color="var(--chart-2)" />
          <MarginRing label="Expense Ratio" value={snapshot.expenseRatio} color="var(--chart-4)" />
          <MarginRing
            label="Gross Profit Margin"
            value={snapshot.grossMargin}
            color={snapshot.grossMargin < 0 ? "var(--destructive)" : "var(--chart-1)"}
          />
          <MarginRing
            label="Net Profit Margin"
            value={snapshot.netMargin}
            color={snapshot.netMargin < 0 ? "var(--destructive)" : "var(--chart-5)"}
          />
          <MarginRing label="Withdrawal Ratio" value={snapshot.withdrawalRatio} color="var(--chart-3)" />
          <MarginRing label="Project Cost Ratio" value={snapshot.projectCostRatio} color="var(--chart-6)" />
          <MarginRing label="Tax Ratio" value={snapshot.taxRatio} color="var(--chart-8)" />
          <MarginRing label="Admin Expense Ratio" value={snapshot.adminRatio} color="var(--chart-7)" />
        </div>
      </Panel>

      <section className="grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-4 xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,3fr)]">
        <Panel title="Annual Gross Profit" caption={model.annualCaption}>
          {model.annual.length > 0 ? (
            <AnnualChart data={model.annual} />
          ) : (
            <EmptyChart />
          )}
        </Panel>
        <Panel title="Project Trend" caption={`Projects Per Year · ${model.trendCaption}`}>
          {model.trend.length > 0 ? <TrendChart data={model.trend} /> : <EmptyChart />}
        </Panel>
        <Panel title="Operational Tenure" className="md:col-span-2 xl:col-span-1">
          <div className="flex flex-col text-sm md:text-label">
            <dl className="contents">
            <div className="flex items-center justify-between gap-3 border-t border-border py-2.5 md:flex-col md:items-start md:gap-0.5 md:border-0 md:py-0">
              <dt className="text-muted-foreground md:font-label">Launch Date</dt>
              <dd className="font-strong md:text-[0.90625rem]">{model.tenure.launchDateLabel}</dd>
            </div>
            <div className="flex flex-col border-t border-border py-2.5 md:mt-4 md:border-0 md:py-0">
              <dt className="text-muted-foreground md:font-label">In Operation</dt>
              <dd className="my-0.5 text-[1.375rem] leading-tight font-bold tracking-[-0.02em] text-primary-text md:text-[1.1875rem] md:tracking-[-0.022em]">
                {model.tenure.inOperation}
              </dd>
              <dd className="text-caption text-muted-foreground md:mt-0.5 md:font-label">{model.tenure.daysLabel}</dd>
            </div>
            </dl>
            <dl className="flex flex-col md:mt-4.5 md:gap-2.5 md:border-t md:border-border md:pt-3.5">
              <TenureRow label="Revenue Per Day">
                <Money value={model.tenure.revenuePerDay} />
              </TenureRow>
              <TenureRow label="Net Profit Per Day">
                <Money
                  value={model.tenure.netProfitPerDay}
                  className={model.tenure.netProfitPerDay < 0 ? "text-destructive" : "text-success"}
                />
              </TenureRow>
            </dl>
          </div>
        </Panel>
      </section>
    </div>
  )
}

function DashboardChrome({
  updatedIso,
  updatedLabel,
  children,
}: {
  updatedIso?: string
  updatedLabel?: string
  children?: ReactNode
}) {
  return (
    <PageHeader
      title="Dashboard"
      className="mb-1.5 md:mb-2"
      description={
        updatedLabel ? (
          <>
            Last Updated <time dateTime={updatedIso}>{updatedLabel}</time>
          </>
        ) : undefined
      }
      actions={children}
    />
  )
}

function OverBudgetCard({ projects }: { projects: readonly OverBudgetProject[] }) {
  return (
    <Card className="min-w-0 gap-0 p-4 md:px-6 md:py-5.5">
      <div className="mb-3">
        <h2 className="text-panel-title font-bold md:font-strong">Projects Over Budget</h2>
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Projects Are Over Budget.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id} className="flex min-w-0 items-center justify-between gap-3">
              <Link
                href={`/projects/${project.id}`}
                className="min-w-0 truncate text-ui font-semibold underline-offset-4 hover:underline"
              >
                {project.name}
              </Link>
              <span className="shrink-0 text-right">
                <span className="block text-caption text-muted-foreground">Over Planned</span>
                <span className="text-destructive">
                  <Money value={project.overAmount} />
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Panel({
  title,
  caption,
  aside,
  stackAside = false,
  className,
  children,
}: {
  title: string
  caption?: string
  aside?: ReactNode
  stackAside?: boolean
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn("min-w-0 gap-0 p-4 md:px-6 md:py-5.5", className)}>
      <div
        className={cn(
          "mb-3 flex justify-between gap-2.5 md:mb-4 md:flex-row md:items-start md:gap-4",
          stackAside ? "flex-col" : "items-start",
        )}
      >
        <div className="min-w-0">
          <h2 className="text-panel-title font-bold md:font-strong">{title}</h2>
          {caption ? <p className="mt-0.5 text-caption text-muted-foreground">{caption}</p> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      {children}
    </Card>
  )
}

function EmptyChart() {
  return (
    <p className="flex h-40 items-center justify-center text-sm text-muted-foreground md:h-60">
      No Records Yet
    </p>
  )
}

function KpiCard({
  label,
  value,
  detail,
  delta,
  lowerIsBetter = false,
  spark,
  sparkColor,
}: {
  label: string
  value: number
  detail?: string
  delta: number | null
  lowerIsBetter?: boolean
  spark: { label: string; value: number }[]
  sparkColor: string
}) {
  return (
    <Card className="min-w-0 gap-0 px-4 pt-4 pb-2.5 md:px-5.5 md:pt-5 md:pb-1.5">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-muted-foreground md:text-ui">{label}</p>
        {delta != null ? <DeltaBadge value={delta} lowerIsBetter={lowerIsBetter} /> : null}
      </div>
      <p className={cn("mt-1.5 min-w-0 truncate text-kpi md:mt-2.5", value < 0 && "text-destructive")}>
        <Money value={value} size="kpi" />
      </p>
      <p className={cn("text-caption text-muted-foreground md:mt-px md:h-4.5", !detail && "hidden md:block")}>
        {detail}
      </p>
      <div className="mt-1.5 md:mt-2">
        <Sparkline data={spark} color={sparkColor} />
      </div>
    </Card>
  )
}

function CompactMetric({
  label,
  value,
  detail,
  tone = "default",
  icon: Icon,
  wide = false,
}: {
  label: string
  value: number
  detail?: string
  tone?: "default" | "negative" | "warning" | "positive"
  icon?: LucideIcon
  wide?: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl bg-surface px-3.5 py-3.25 shadow-glass backdrop-blur-glass backdrop-saturate-180 md:rounded-none md:border-l md:border-border md:bg-transparent md:px-5 md:py-4.5 md:shadow-none md:backdrop-blur-none md:backdrop-saturate-100 md:first:border-l-0",
        tone === "warning" && "bg-warning-wash md:bg-warning-wash",
        wide && "col-span-2 flex items-center justify-between gap-3 md:col-span-1 md:block",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1.25 text-caption font-semibold md:gap-1.5",
          tone === "warning" ? "text-warning" : "text-muted-foreground",
        )}
      >
        {Icon ? (
          <Icon
            aria-hidden="true"
            className={cn(
              "size-3.5",
              tone === "positive" && "text-success",
              tone === "negative" && "text-destructive",
            )}
          />
        ) : null}
        {label}
      </p>
      <p
        className={cn(
          "min-w-0 truncate text-[1.03125rem] leading-tight font-bold tracking-[-0.02em] md:mt-1.5 md:text-[1.1875rem] md:tracking-[-0.022em]",
          !wide && "mt-1.25",
          tone === "negative" || value < 0 ? "text-destructive" : "text-foreground",
        )}
      >
        <Money value={value} />
      </p>
      {detail ? (
        <p className="mt-0.5 truncate text-micro text-muted-foreground md:text-xs">{detail}</p>
      ) : wide ? null : (
        <p aria-hidden="true" className="mt-0.5 hidden text-xs md:block">
          &nbsp;
        </p>
      )}
    </div>
  )
}

function MetricTile({
  icon: Icon,
  color,
  label,
  value,
  hint,
  bar,
}: {
  icon: LucideIcon
  color: string
  label: string
  value: ReactNode
  hint?: string
  bar?: number
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl bg-surface px-3.5 py-3.25 shadow-glass backdrop-blur-glass backdrop-saturate-180 last:odd:col-span-2 md:flex-row md:items-start md:gap-3.5 md:rounded-tile md:bg-fill md:p-4 md:shadow-none md:backdrop-blur-none md:backdrop-saturate-100 lg:last:odd:col-span-1">
      <span
        className={cn(
          "mb-2.25 flex size-7.5 shrink-0 items-center justify-center rounded-[9px] text-on-color tile-sheen md:mb-0 md:size-9.5 md:rounded-xl",
          color,
        )}
      >
        <Icon aria-hidden="true" className="size-4 md:size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-muted-foreground md:text-caption md:font-label">{label}</p>
        <p className="mt-0.5 truncate text-metric tabular-nums">
          {value}
        </p>
        {hint ? <p className="mt-px truncate text-micro text-subtle-foreground md:text-xs">{hint}</p> : null}
        {bar != null ? (
          <div className="mt-2 h-1.25 overflow-hidden rounded-full bg-fill md:mt-2.25 md:h-1.5 md:bg-fill-strong">
            <div
              className={cn("h-full rounded-full", color)}
              style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MarginRing({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <Ring value={value} color={color}>
        {formatRatio(value)}
      </Ring>
      <p className="mt-1.5 text-micro font-semibold text-muted-foreground md:mt-2.5 md:text-caption md:font-label">
        {label}
      </p>
    </div>
  )
}

function TenureRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-border py-2.5 last:pb-0 md:flex-col md:items-start md:gap-px md:border-0 md:py-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-strong tracking-[-0.015em] md:text-left md:text-base md:font-bold">{children}</dd>
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
    <div
      className={cn(
        "min-w-0 rounded-[14px] bg-fill px-3 py-2.5 md:py-2.75",
        emphasize && "col-span-2 md:col-span-1",
      )}
    >
      <p className="text-micro leading-snug font-semibold text-muted-foreground md:min-h-8 md:font-label">{label}</p>
      <p
        className={cn(
          "mt-0.75 flex items-center gap-1 text-sm font-bold tracking-[-0.01em] md:mt-0 md:gap-1.25 md:text-label",
          emphasize && (value < 0 ? "text-destructive" : "text-success"),
        )}
      >
        <Money value={value} className="min-w-0 truncate" />
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
    return <Minus aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
  }
  const improved = tone === "good" ? direction === "up" : direction === "down"
  const Icon = direction === "up" ? TrendingUp : TrendingDown
  return (
    <Icon
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", improved ? "text-success" : "text-destructive")}
    />
  )
}

function DeltaBadge({
  value,
  lowerIsBetter = false,
}: {
  value: number
  lowerIsBetter?: boolean
}) {
  const flat = Math.abs(value) < 0.05
  const rising = value > 0
  const Icon = flat ? Minus : rising ? TrendingUp : TrendingDown
  const favorable = lowerIsBetter ? value < 0 : rising
  return (
    <Badge
      variant={flat ? "secondary" : favorable ? "success" : "destructive"}
      className="h-6 shrink-0 gap-0.75 px-2.25 text-xs font-bold md:h-6 md:gap-1 md:font-strong"
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {flat ? formatDelta(0) : formatDelta(value)}
    </Badge>
  )
}

function downloadDashboard(
  model: DashboardModel,
  snapshot: YearSnapshot,
  showFinancials: boolean,
) {
  const rows: (string | number)[][] = [
    ["Dashboard", "DSA ERP"],
    ["Fiscal Year", model.scopeLabel],
    ["Last Updated", model.updatedLabel],
    [],
    ["Metric", "Amount"],
    ["Total Revenue", formatExactBdt(snapshot.revenue)],
    ["Total Expense", formatExactBdt(snapshot.totalExpense)],
    ["Net Profit", formatExactBdt(snapshot.netProfit)],
    ...(showFinancials ? [["Cash Balance", formatExactBdt(model.cashBalance)] as (string | number)[]] : []),
    ["Gross Profit", formatExactBdt(snapshot.grossProfit)],
    ["Accounts Receivable", formatExactBdt(model.receivables)],
    ["Accounts Payable", formatExactBdt(model.payables)],
    ["Forecasted Profit", formatExactBdt(model.forecastedProfit)],
    ["Withdrawal", formatExactBdt(snapshot.withdrawal)],
    ["Project Expense", formatExactBdt(snapshot.projectExpense)],
    ["Material Cost", formatExactBdt(snapshot.material)],
    ["Subcontractor Cost", formatExactBdt(snapshot.subcontractor)],
    ["Project Overhead", formatExactBdt(snapshot.projectOverhead)],
    ["Tax Paid", formatExactBdt(snapshot.tax)],
    ["Admin Expense", formatExactBdt(snapshot.admin)],
    ["Operational Expense", formatExactBdt(snapshot.operational)],
    ["Marketing", formatExactBdt(snapshot.marketing)],
    ["Employee Salary", formatExactBdt(snapshot.salary)],
    ["Collection Rate", snapshot.collectionRate],
    ["Expense Ratio", snapshot.expenseRatio],
    ["Gross Profit Margin", snapshot.grossMargin],
    ["Net Profit Margin", snapshot.netMargin],
    ["Withdrawal Ratio", snapshot.withdrawalRatio],
    ["Project Cost Ratio", snapshot.projectCostRatio],
    ["Tax Ratio", snapshot.taxRatio],
    ["Admin Expense Ratio", snapshot.adminRatio],
    ["High-Value Projects", model.performance.highValue],
    ["Low-Value Projects", model.performance.lowValue],
    ["Active Projects", model.performance.active],
    ["Projects in Leads", model.performance.openLeads],
    ["Clients", model.performance.clients],
    ["Project Lead Value", formatExactBdt(model.performance.leadValue)],
    ["Win Rate", model.performance.winRate],
    ["Collection Efficiency", model.performance.collectionEfficiency],
    ["Backlog Projects", model.performance.backlog],
    ["Launch Date", model.tenure.launchDateLabel],
    ["In Operation", model.tenure.inOperation],
    ["Revenue Per Day", formatExactBdt(model.tenure.revenuePerDay)],
    ["Net Profit Per Day", formatExactBdt(model.tenure.netProfitPerDay)],
  ]
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
    .join("\r\n")
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `dsa-erp-dashboard-${model.scopeYear == null ? "all-time" : `fy${model.scopeYear}`}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
