"use client"

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react"

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
  const buttonRefs = useRef<
    Partial<Record<SettlementFilter, HTMLButtonElement | null>>
  >({})
  const [seenValue, setSeenValue] = useState(value)
  const [pending, setPending] = useState<{
    from: SettlementFilter
    to: SettlementFilter
  } | null>(null)
  if (seenValue !== value) {
    setSeenValue(value)
    setPending(null)
  }
  const shown = pending && pending.from === value ? pending.to : value

  function choose(next: SettlementFilter) {
    if (next !== shown) setPending({ from: value, to: next })
    onChange(next)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const active = document.activeElement
    const focusedIndex = settlementFilters.findIndex(
      (f) => buttonRefs.current[f] === active,
    )
    const currentIndex =
      focusedIndex >= 0 ? focusedIndex : settlementFilters.indexOf(shown)
    const fallbackIndex = currentIndex >= 0 ? currentIndex : 0
    const length = settlementFilters.length
    let nextIndex: number | null = null

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (fallbackIndex + 1) % length
        break
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex = (fallbackIndex - 1 + length) % length
        break
      case "Home":
        nextIndex = 0
        break
      case "End":
        nextIndex = length - 1
        break
      default:
        return
    }

    event.preventDefault()
    const next = settlementFilters[nextIndex]
    if (!next) return
    choose(next)
    buttonRefs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className="flex w-full min-w-0 flex-wrap gap-1.5 md:w-auto"
    >
      {settlementFilters.map((filter) => {
        const selected = shown === filter
        const formattedCount = formatGroupedCount(counts[filter])
        return (
          <button
            key={filter}
            ref={(node) => {
              buttonRefs.current[filter] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${labels[filter]}, ${formattedCount}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => choose(filter)}
            className={cn(
              "inline-flex h-8 max-w-full items-center justify-center gap-1.5 rounded-full px-3 text-label font-semibold whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              selected
                ? "bg-segment-active text-foreground shadow-segment"
                : "bg-fill text-muted-foreground hover:text-foreground",
            )}
          >
            <span>{labels[filter]}</span>
            <span className="tabular-nums">{formattedCount}</span>
          </button>
        )
      })}
    </div>
  )
}
