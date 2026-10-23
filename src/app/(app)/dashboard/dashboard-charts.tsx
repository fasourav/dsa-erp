"use client"

import { useId, useState, useSyncExternalStore, type ReactNode } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { formatAxisBdt, formatExactBdt, type ChartPoint } from "@/lib/dashboard-metrics"
import { cn } from "@/lib/utils"

// Slice order and colors follow the Atrium Expense Summary.
export const expenseSliceStyle = [
  { key: "subcontractor", label: "Subcontractor Cost", fill: "var(--chart-5)", swatch: "bg-chart-5" },
  { key: "material", label: "Material Cost", fill: "var(--chart-1)", swatch: "bg-chart-1" },
  { key: "projectOverhead", label: "Project Overhead", fill: "var(--chart-6)", swatch: "bg-chart-6" },
  { key: "tax", label: "Tax Paid", fill: "var(--chart-8)", swatch: "bg-chart-8" },
  { key: "operational", label: "Operational Expense", fill: "var(--chart-3)", swatch: "bg-chart-3" },
  { key: "marketing", label: "Marketing", fill: "var(--chart-10)", swatch: "bg-chart-10" },
  { key: "salary", label: "Employee Salary", fill: "var(--chart-9)", swatch: "bg-chart-9" },
] as const

type ExpenseSlice = {
  key: string
  label: string
  amount: number
  fill: string
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

const axisTick = { fill: "var(--subtle-foreground)", fontSize: 11.5 }
const gridProps = { stroke: "var(--border)", strokeDasharray: "3 5", vertical: false } as const

function useChartReady(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
}

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const media = window.matchMedia(query)
      media.addEventListener("change", onStoreChange)
      return () => media.removeEventListener("change", onStoreChange)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

function useReducedMotion(): boolean {
  return useMedia("(prefers-reduced-motion: reduce)")
}

function useDesktop(): boolean {
  return useMedia("(width >= 48rem)")
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
    <div className="min-w-44 rounded-xl bg-popover px-2.5 py-1.5 text-micro text-popover-foreground glass-float md:min-w-50 md:rounded-2xl md:px-3 md:py-2.5 md:text-xs">
      {label != null ? <p className="mb-0.5 font-bold md:mb-1.5 md:text-caption">{label}</p> : null}
      {payload.map((entry) => (
        <p
          key={`${entry.name ?? "value"}-${entry.value}`}
          className="flex items-center justify-between gap-3 text-muted-foreground md:mt-0.75 md:gap-4"
        >
          {entry.name ? (
            <span className="flex items-center gap-1.5 md:gap-1.75">
              <span className="size-1.75 rounded-full md:size-2" style={{ background: entry.color }} />
              {entry.name}
            </span>
          ) : null}
          <span className="font-bold text-foreground tabular-nums md:font-strong">
            {formatValue(entry.value ?? 0)}
          </span>
        </p>
      ))}
    </div>
  )
}

function tooltipEntries(
  payload: ReadonlyArray<{ name?: unknown; value?: unknown; color?: string; stroke?: string }> | undefined,
): TooltipEntry[] {
  return (payload ?? []).map((entry) => ({
    name: typeof entry.name === "string" ? entry.name : undefined,
    value: typeof entry.value === "number" ? entry.value : Number(entry.value) || 0,
    color: entry.stroke ?? entry.color,
  }))
}

function pointLabel(
  payload: ReadonlyArray<{ payload?: unknown }> | undefined,
): string | undefined {
  const point = payload?.[0]?.payload
  if (point && typeof point === "object" && "label" in point) {
    const label = point.label
    if (typeof label === "string" && label.length > 0) return label
  }
  return undefined
}

function Fade({ id, color, from }: { id: string; color: string; from: number }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={color} stopOpacity={from} />
      <stop offset="1" stopColor={color} stopOpacity={0} />
    </linearGradient>
  )
}

// KPI sparkline: area filled to the card bottom, 2.2px stroke, a ring on the latest point.
// Drawn as SVG so the fill reaches the plot floor (mockup d02/m02). A Recharts
// domain of dataMin–dataMax collapsed flat series into a hairline at the edge.
export function Sparkline({ data, color }: { data: ChartPoint[]; color: string }) {
  const gradient = useId().replace(/:/g, "")
  const [hover, setHover] = useState<number | null>(null)
  const geometry = sparkGeometry(data)
  if (!geometry) return <div className="h-11.5 md:h-16" />

  const active = hover != null ? data[hover] : null

  return (
    <div className="relative h-11.5 min-w-0 md:h-16">
      <svg
        viewBox="0 0 262 64"
        preserveAspectRatio="none"
        className="block h-full w-full overflow-visible"
        aria-hidden="true"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          if (rect.width <= 0) return
          const x = ((event.clientX - rect.left) / rect.width) * 262
          let nearest = 0
          let best = Number.POSITIVE_INFINITY
          geometry.xs.forEach((point, index) => {
            const distance = Math.abs(point - x)
            if (distance < best) {
              best = distance
              nearest = index
            }
          })
          setHover(nearest)
        }}
      >
        <defs>
          <Fade id={gradient} color={color} from={0.32} />
        </defs>
        <path d={geometry.area} fill={`url(#${gradient})`} />
        <path
          d={geometry.line}
          fill="none"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={geometry.cx}
          cy={geometry.cy}
          r={3.5}
          fill="var(--solid)"
          stroke={color}
          strokeWidth={2.2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {active && hover != null ? (
        <div
          className="pointer-events-none absolute bottom-full z-10 -translate-x-1/2 pb-1"
          style={{ left: `${(geometry.xs[hover] / 262) * 100}%` }}
        >
          <ChartTooltip
            active
            label={active.label}
            payload={[{ value: active.value, color }]}
            formatValue={formatExactBdt}
          />
        </div>
      ) : null}
    </div>
  )
}

function sparkGeometry(data: ChartPoint[]) {
  if (data.length === 0) return null
  const height = 64
  const left = 2
  const right = 256
  const top = 5
  const baseline = 59
  const values = data.map((point) => point.value)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  if (max - min < 1e-6) {
    const pad = Math.max(Math.abs(max), 1)
    min -= pad
    max += pad * 0.35
  }
  const count = values.length
  const xs = values.map((_, index) =>
    count === 1 ? (left + right) / 2 : left + ((right - left) * index) / (count - 1),
  )
  const ys = values.map((value) => {
    const t = (value - min) / (max - min)
    return baseline - t * (baseline - top)
  })
  const line = smoothLine(xs, ys)
  const area = `${line} L${xs[count - 1].toFixed(1)},${height} L${xs[0].toFixed(1)},${height} Z`
  return { line, area, xs, cx: xs[count - 1], cy: ys[count - 1] }
}

function smoothLine(xs: number[], ys: number[]) {
  const move = `M${xs[0].toFixed(1)},${ys[0].toFixed(1)}`
  if (xs.length === 1) return move
  let path = move
  for (let index = 0; index < xs.length - 1; index += 1) {
    const previousX = xs[Math.max(index - 1, 0)]
    const previousY = ys[Math.max(index - 1, 0)]
    const startX = xs[index]
    const startY = ys[index]
    const endX = xs[index + 1]
    const endY = ys[index + 1]
    const nextX = xs[Math.min(index + 2, xs.length - 1)]
    const nextY = ys[Math.min(index + 2, ys.length - 1)]
    const control1X = startX + (endX - previousX) / 6
    const control1Y = startY + (endY - previousY) / 6
    const control2X = endX - (nextX - startX) / 6
    const control2Y = endY - (nextY - startY) / 6
    path += ` C${control1X.toFixed(1)},${control1Y.toFixed(1)} ${control2X.toFixed(1)},${control2Y.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`
  }
  return path
}

export function WeeklyChart({ data }: { data: WeekChartRow[] }) {
  const ready = useChartReady()
  const reduced = useReducedMotion()
  const desktop = useDesktop()
  const revenueFade = useId()
  const expenseFade = useId()
  if (!ready) return <div className="h-48 md:h-72" />

  const activeDot = (color: string) => ({ r: 5.5, fill: "var(--solid)", stroke: color, strokeWidth: 2.5 })

  return (
    <div className="h-48 min-w-0 md:h-72" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart accessibilityLayer={false} data={data} margin={{ top: 8, right: desktop ? 8 : 4, left: 0, bottom: 0 }}>
          <defs>
            <Fade id={revenueFade} color="var(--chart-1)" from={0.3} />
            <Fade id={expenseFade} color="var(--chart-3)" from={0.3} />
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            tick={{ ...axisTick, fontSize: desktop ? 11.5 : 11 }}
            axisLine={false}
            tickLine={false}
            interval={desktop ? 0 : 1}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={formatAxisBdt}
            tick={{ ...axisTick, fontSize: desktop ? 11.5 : 11 }}
            axisLine={false}
            tickLine={false}
            tickCount={4}
            width={desktop ? 50 : 38}
          />
          <Tooltip
            cursor={{ stroke: "var(--subtle-foreground)", strokeDasharray: "2 3" }}
            content={(props) => (
              <ChartTooltip
                active={props.active}
                label={pointLabel(props.payload)}
                payload={tooltipEntries(props.payload)}
                formatValue={formatExactBdt}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="var(--chart-1)"
            fill={`url(#${revenueFade})`}
            strokeWidth={2.6}
            strokeLinecap="round"
            activeDot={activeDot("var(--chart-1)")}
            isAnimationActive={!reduced}
          />
          <Area
            type="monotone"
            dataKey="totalExpense"
            name="Total Expense"
            stroke="var(--chart-3)"
            fill={`url(#${expenseFade})`}
            strokeWidth={2.6}
            strokeLinecap="round"
            activeDot={activeDot("var(--chart-3)")}
            isAnimationActive={!reduced}
          />
          <Line
            type="monotone"
            dataKey="netProfit"
            name="Net Profit"
            stroke="var(--chart-2)"
            strokeWidth={2.6}
            strokeDasharray="5 6"
            strokeLinecap="round"
            dot={false}
            activeDot={activeDot("var(--chart-2)")}
            isAnimationActive={!reduced}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

// Ring segments with a hairline gap between slices, drawn from 12 o'clock.
export function ExpenseDonut({ slices, children }: { slices: ExpenseSlice[]; children?: ReactNode }) {
  const radius = 86
  const circumference = 2 * Math.PI * radius
  const gap = slices.filter((slice) => slice.amount > 0).length > 1 ? 3.6 : 0
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.amount), 0)
  let offset = gap / 2

  return (
    <div className="relative mx-auto size-50 md:size-49">
      <svg viewBox="0 0 196 196" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="98" cy="98" r={radius} fill="none" stroke="var(--fill)" strokeWidth="22" />
        {total > 0
          ? slices.map((slice) => {
              if (slice.amount <= 0) return null
              const length = Math.max(0, (slice.amount / total) * circumference - gap)
              const dash = (
                <circle
                  key={slice.key}
                  cx="98"
                  cy="98"
                  r={radius}
                  fill="none"
                  stroke={slice.fill}
                  strokeWidth="22"
                  strokeDasharray={`${length} ${circumference}`}
                  strokeDashoffset={-offset}
                />
              )
              offset += length + gap
              return dash
            })
          : null}
      </svg>
      {children ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      ) : null}
    </div>
  )
}

// Margin Analysis ring: 72px on phones, 104px on desktop, 12/104 stroke.
export function Ring({ value, color, children }: { value: number; color: string; children: ReactNode }) {
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const arc = (Math.max(0, Math.min(100, value)) / 100) * circumference

  return (
    <div className="relative size-18 md:size-26">
      <svg viewBox="0 0 104 104" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="52" cy="52" r={radius} fill="none" stroke="var(--fill-strong)" strokeWidth="12" />
        {arc > 0 ? (
          <circle
            cx="52"
            cy="52"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
          />
        ) : null}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-caption font-bold tracking-[-0.02em] tabular-nums md:text-callout">
        {children}
      </span>
    </div>
  )
}

function shortYear(label: string) {
  return /^FY\d{4}$/.test(label) ? `FY${label.slice(4)}` : label
}

export function AnnualChart({
  data,
}: {
  data: { label: string; grossProfit: number }[]
}) {
  const ready = useChartReady()
  const reduced = useReducedMotion()
  const desktop = useDesktop()
  const past = useId()
  const current = useId()
  if (!ready) return <div className="h-48 md:h-60" />
  const last = data.length - 1

  return (
    <div className="h-48 min-w-0 md:h-60" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart accessibilityLayer={false} data={data} margin={{ top: 22, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={past} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity={1} />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id={current} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chart-1)" stopOpacity={1} />
              <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0.7} />
            </linearGradient>
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            tick={{ ...axisTick, fontSize: desktop ? 11.5 : 10.5 }}
            tickFormatter={desktop ? undefined : shortYear}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            tickFormatter={(value: number) => (desktop ? formatAxisBdt(value) : formatAxisBdt(value).replace(/\.0(?=Cr|L)/, ""))}
            tick={{ ...axisTick, fontSize: desktop ? 11.5 : 10.5 }}
            axisLine={false}
            tickLine={false}
            tickCount={5}
            width={desktop ? 50 : 34}
          />
          <Tooltip
            cursor={{ fill: "var(--fill)" }}
            content={(props) => (
              <ChartTooltip
                active={props.active}
                label={pointLabel(props.payload)}
                payload={tooltipEntries(props.payload).map((entry) => ({ ...entry, color: "var(--chart-1)" }))}
                formatValue={formatExactBdt}
              />
            )}
          />
          <Bar
            dataKey="grossProfit"
            name="Gross Profit"
            maxBarSize={desktop ? 36 : 28}
            radius={[10, 10, 0, 0]}
            isAnimationActive={!reduced}
            label={(props: { x?: unknown; y?: unknown; width?: unknown; value?: unknown; index?: number }) => {
              const x = Number(props.x ?? 0) + Number(props.width ?? 0) / 2
              const y = Number(props.y ?? 0) - 7
              const value = Number(props.value) || 0
              const text = formatAxisBdt(value)
              return (
                <text
                  key={props.index}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  fontSize={desktop ? 11.5 : 10.5}
                  fontWeight={desktop ? 650 : 700}
                  fill={props.index === last ? "var(--foreground)" : "var(--muted-foreground)"}
                  className="tabular-nums"
                >
                  {desktop ? text : text.replace("৳", "")}
                </text>
              )
            }}
          >
            {data.map((point, index) => (
              <Cell
                key={point.label}
                fill={point.grossProfit < 0 ? "var(--destructive)" : `url(#${index === last ? current : past})`}
                fillOpacity={index === last ? 1 : 0.42}
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
  const desktop = useDesktop()
  const fade = useId()
  if (!ready) return <div className="h-40 md:h-60" />

  return (
    <div className="h-40 min-w-0 md:h-60" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart accessibilityLayer={false} data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <Fade id={fade} color="var(--chart-5)" from={0.34} />
          </defs>
          <CartesianGrid {...gridProps} />
          <XAxis
            dataKey="label"
            tick={{ ...axisTick, fontSize: desktop ? 11.5 : 10.5 }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
            padding={{ left: 4, right: 4 }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ ...axisTick, fontSize: desktop ? 11.5 : 10.5 }}
            axisLine={false}
            tickLine={false}
            tickCount={5}
            width={desktop ? 30 : 24}
          />
          <Tooltip
            cursor={{ stroke: "var(--subtle-foreground)", strokeDasharray: "2 3" }}
            content={(props) => (
              <ChartTooltip
                active={props.active}
                label={pointLabel(props.payload)}
                payload={tooltipEntries(props.payload)}
                formatValue={(value) => String(Math.round(value))}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Projects"
            stroke="var(--chart-5)"
            fill={`url(#${fade})`}
            strokeWidth={2.6}
            strokeLinecap="round"
            dot={{ r: 2.6, fill: "var(--solid)", stroke: "var(--chart-5)", strokeWidth: 2 }}
            activeDot={{ r: 4.5, fill: "var(--solid)", stroke: "var(--chart-5)", strokeWidth: 2.5 }}
            isAnimationActive={!reduced}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function LegendDot({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 md:gap-1.75">
      <span
        aria-hidden="true"
        className={cn(dashed ? "h-0.75 w-3 rounded-xs md:w-3.5" : "size-2 rounded-full md:size-2.25")}
        style={{ background: color }}
      />
      {label}
    </span>
  )
}
