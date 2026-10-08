"use client"

import { useSyncExternalStore } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatAxisBdt, formatCompactBdt, type ChartPoint } from "@/lib/dashboard-metrics"

export const expenseSliceStyle = [
  {
    key: "subcontractor",
    label: "Subcontractor Cost",
    fill: "var(--chart-1)",
    swatch: "bg-chart-1",
    opacity: 1,
  },
  {
    key: "material",
    label: "Material Cost",
    fill: "var(--chart-2)",
    swatch: "bg-chart-2",
    opacity: 1,
  },
  {
    key: "tax",
    label: "Tax Paid",
    fill: "var(--chart-3)",
    swatch: "bg-chart-3",
    opacity: 1,
  },
  {
    key: "admin",
    label: "Admin Expense",
    fill: "var(--chart-4)",
    swatch: "bg-chart-4",
    opacity: 1,
  },
  {
    key: "operational",
    label: "Operational Expense",
    fill: "var(--chart-5)",
    swatch: "bg-chart-5",
    opacity: 1,
  },
  {
    key: "marketing",
    label: "Marketing",
    fill: "var(--chart-1)",
    swatch: "bg-chart-1/60",
    opacity: 0.6,
  },
  {
    key: "salary",
    label: "Employee Salary",
    fill: "var(--chart-3)",
    swatch: "bg-chart-3/50",
    opacity: 0.5,
  },
] as const

type ExpenseSlice = {
  key: string
  label: string
  amount: number
  fill: string
  opacity: number
}

type WeekChartRow = {
  label: string
  revenue: number
  totalExpense: number
  netProfit: number
}

type TooltipEntry = {
  name?: string
  value?: number
  color?: string
}

function useChartReady(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)")
      media.addEventListener("change", onStoreChange)
      return () => media.removeEventListener("change", onStoreChange)
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  )
}

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
  formatValue: (value: number) => string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10">
      {label != null ? <p className="mb-1 font-medium">{label}</p> : null}
      {payload.map((entry) => (
        <p key={`${entry.name}-${entry.value}`} className="tabular-nums">
          {entry.name}: {formatValue(entry.value ?? 0)}
        </p>
      ))}
    </div>
  )
}

function tooltipEntries(
  payload: ReadonlyArray<{ name?: unknown; value?: unknown; color?: string }> | undefined,
): TooltipEntry[] {
  return (payload ?? []).map((entry) => ({
    name: typeof entry.name === "string" ? entry.name : undefined,
    value: typeof entry.value === "number" ? entry.value : Number(entry.value) || 0,
    color: entry.color,
  }))
}

export function Sparkline({
  data,
  color,
}: {
  data: ChartPoint[]
  color: string
}) {
  const ready = useChartReady()
  const reduced = useReducedMotion()
  if (!ready) return <div className="h-12" />

  return (
    <div className="h-12 min-w-0" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
          <Tooltip
            content={(props) => (
              <ChartTooltip
                active={props.active}
                label={props.label}
                payload={tooltipEntries(props.payload)}
                formatValue={formatCompactBdt}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="value"
            name="Amount"
            stroke={color}
            fill={color}
            fillOpacity={0.18}
            strokeWidth={2}
            dot={false}
            isAnimationActive={!reduced}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WeeklyChart({ data }: { data: WeekChartRow[] }) {
  const ready = useChartReady()
  const reduced = useReducedMotion()
  if (!ready) return <div className="h-64" />

  return (
    <div className="h-64 min-w-0" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="4 4" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            minTickGap={12}
          />
          <YAxis
            tickFormatter={formatAxisBdt}
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            content={(props) => (
              <ChartTooltip
                active={props.active}
                label={props.label}
                payload={tooltipEntries(props.payload)}
                formatValue={formatCompactBdt}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.16}
            strokeWidth={2}
            isAnimationActive={!reduced}
          />
          <Line
            type="monotone"
            dataKey="totalExpense"
            name="Total Expense"
            stroke="var(--chart-4)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={!reduced}
          />
          <Line
            type="monotone"
            dataKey="netProfit"
            name="Net Profit"
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={!reduced}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ExpenseDonut({ slices }: { slices: ExpenseSlice[] }) {
  const ready = useChartReady()
  const reduced = useReducedMotion()
  const plotted = slices.filter((slice) => slice.amount > 0)
  if (!ready) return <div className="h-44" />
  if (plotted.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center" aria-hidden="true">
        <div className="size-28 rounded-full border-8 border-muted" />
      </div>
    )
  }

  return (
    <div className="h-44 min-w-0" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            content={(props) => (
              <ChartTooltip
                active={props.active}
                payload={tooltipEntries(props.payload)}
                formatValue={formatCompactBdt}
              />
            )}
          />
          <Pie
            data={plotted}
            dataKey="amount"
            nameKey="label"
            innerRadius="62%"
            outerRadius="82%"
            stroke="none"
            paddingAngle={plotted.length > 1 ? 2 : 0}
            isAnimationActive={!reduced}
          >
            {plotted.map((slice) => (
              <Cell key={slice.key} fill={slice.fill} fillOpacity={slice.opacity} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function AnnualChart({
  data,
}: {
  data: { label: string; grossProfit: number }[]
}) {
  const ready = useChartReady()
  const reduced = useReducedMotion()
  if (!ready) return <div className="h-52" />

  return (
    <div className="h-52 min-w-0" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={(props) => (
              <ChartTooltip
                active={props.active}
                label={props.label}
                payload={tooltipEntries(props.payload)}
                formatValue={formatCompactBdt}
              />
            )}
          />
          <Bar
            dataKey="grossProfit"
            name="Gross Profit"
            maxBarSize={48}
            radius={[6, 6, 0, 0]}
            isAnimationActive={!reduced}
            label={{
              position: "top",
              fill: "var(--foreground)",
              fontSize: 12,
              formatter: (value) =>
                formatCompactBdt(typeof value === "number" ? value : Number(value) || 0),
            }}
          >
            {data.map((point) => (
              <Cell
                key={point.label}
                fill={point.grossProfit < 0 ? "var(--destructive)" : "var(--chart-1)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function TrendChart({ data }: { data: { label: string; count: number }[] }) {
  const ready = useChartReady()
  const reduced = useReducedMotion()
  if (!ready) return <div className="h-52" />

  return (
    <div className="h-52 min-w-0" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            content={(props) => (
              <ChartTooltip
                active={props.active}
                label={props.label}
                payload={tooltipEntries(props.payload)}
                formatValue={(value) => String(Math.round(value))}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Projects"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.16}
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--background)", stroke: "var(--chart-1)", strokeWidth: 2 }}
            isAnimationActive={!reduced}
            label={{
              position: "top",
              fill: "var(--foreground)",
              fontSize: 12,
              formatter: (value) => String(value ?? ""),
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
