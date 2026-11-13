"use client"

import type { ReactNode } from "react"

import { useSeesMoney } from "@/components/access-provider"
import { formatCompactBdt, formatExactBdt } from "@/lib/dashboard-metrics"
import { formatGroupedAmount } from "@/lib/format"
import { cn } from "@/lib/utils"

// Slice order and colors follow the Atrium Expense Summary.
export const expenseSliceStyle = [
  { key: "subcontractor", label: "Subcontractor Cost", fill: "var(--chart-5)", swatch: "bg-chart-5" },
  { key: "material", label: "Material Cost", fill: "var(--chart-1)", swatch: "bg-chart-1" },
  { key: "projectOverhead", label: "Project Overhead", fill: "var(--chart-7)", swatch: "bg-chart-7" },
  { key: "tax", label: "Tax Paid", fill: "var(--chart-8)", swatch: "bg-chart-8" },
  { key: "operational", label: "Operational Expense", fill: "var(--chart-3)", swatch: "bg-chart-3" },
  { key: "marketing", label: "Marketing", fill: "var(--chart-10)", swatch: "bg-chart-10" },
  { key: "salary", label: "Employee Salary", fill: "var(--chart-9)", swatch: "bg-chart-9" },
] as const

const DONUT_COMPACT_MIN = 1_000_000

function formatDonutBdt(value: number): string {
  const safe = Number.isFinite(value) ? value : 0
  if (Math.abs(safe) >= DONUT_COMPACT_MIN) {
    return formatCompactBdt(safe)
  }
  const sign = safe < 0 ? "−" : ""
  return `${sign}৳${formatGroupedAmount(Math.abs(safe), 0)}`
}

export function DonutCentre({
  label,
  amount,
  share,
}: {
  label: string
  amount: number
  share?: string
}) {
  const seesMoney = useSeesMoney()
  const exact = formatExactBdt(amount)

  return (
    <>
      {seesMoney ? (
        <span
          title={exact}
          aria-label={exact}
          className="whitespace-nowrap text-callout font-bold tracking-[-0.02em] tabular-nums md:text-panel-title"
        >
          {formatDonutBdt(amount)}
        </span>
      ) : (
        <span className="whitespace-nowrap text-callout font-bold tracking-[-0.02em] text-muted-foreground tabular-nums md:text-panel-title">
          Hidden
        </span>
      )}
      <span className="w-full truncate text-micro text-muted-foreground md:text-xs">
        {label}
      </span>
      {share ? (
        <span className="w-full truncate text-micro text-muted-foreground tabular-nums">
          {share}
        </span>
      ) : null}
    </>
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
