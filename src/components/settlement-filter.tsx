"use client"

import type { ReactNode } from "react"

import { formatGroupedCount } from "@/lib/format"
import {
  settlementFilters,
  type SettlementCounts,
  type SettlementFilter,
} from "@/lib/settlement-filter"
import { cn } from "@/lib/utils"

const labels: Record<SettlementFilter, string> = {
  outstanding: "Outstanding",
  settled: "Settled",
  all: "All",
}

export function ListFilterBar({
  search,
  filter,
}: {
  search: ReactNode
  filter: ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center md:gap-2.5">
      <div className="w-full min-w-0 md:max-w-sm">{search}</div>
      <div className="min-w-0 md:shrink-0">{filter}</div>
    </div>
  )
}

export function SettlementFilterControl({
  value,
  counts,
  onChange,
  label = "Settlement",
}: {
  value: SettlementFilter
  counts: SettlementCounts
  onChange: (next: SettlementFilter) => void
  label?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex w-full min-w-0 flex-wrap gap-1.5 md:w-auto"
    >
      {settlementFilters.map((filter) => {
        const selected = value === filter
        return (
          <button
            key={filter}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(filter)}
            className={cn(
              "inline-flex h-8 max-w-full items-center justify-center gap-1.5 rounded-full px-3 text-label font-semibold whitespace-nowrap",
              selected
                ? "bg-segment-active text-foreground shadow-segment"
                : "bg-fill text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{labels[filter]}</span>
            <span className="tabular-nums">{formatGroupedCount(counts[filter])}</span>
          </button>
        )
      })}
    </div>
  )
}
