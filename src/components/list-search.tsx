"use client"

import { useId } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function matchesQuery(query: string, text: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return text.toLowerCase().includes(needle)
}

export function rowText(row: object): string {
  return Object.values(row)
    .flatMap((value) => {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      ) {
        return [String(value)]
      }
      return []
    })
    .join(" ")
}

export function filterRows<T extends object>(
  rows: readonly T[],
  query: string,
  text: (row: T) => string,
  filter = "all",
  facet?: (row: T) => string,
): T[] {
  return rows.filter((row) => {
    if (filter !== "all" && facet && facet(row) !== filter) return false
    return matchesQuery(query, text(row))
  })
}

export function ListSearch({
  query,
  onQueryChange,
  placeholder,
  filterLabel,
  filter,
  onFilterChange,
  options,
}: {
  query: string
  onQueryChange: (value: string) => void
  placeholder: string
  filterLabel?: string
  filter?: string
  onFilterChange?: (value: string) => void
  options?: readonly { value: string; label: string }[]
}) {
  const searchId = useId()

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Label htmlFor={searchId}>Search</Label>
        <Input
          id={searchId}
          value={query}
          placeholder={placeholder}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>
      {filterLabel && filter && onFilterChange && options ? (
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-56">
          <Label>{filterLabel}</Label>
          <Select
            items={options.map((option) => ({ value: option.value, label: option.label }))}
            value={filter}
            onValueChange={(value) => {
              if (value) onFilterChange(value)
            }}
          >
            <SelectTrigger className="w-full" aria-label={filterLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}
