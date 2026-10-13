"use client"

import { Search } from "lucide-react"
import { useId } from "react"

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
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
    <div className="flex w-full min-w-0 items-center gap-2 md:gap-2.5">
      <Label htmlFor={searchId} className="sr-only">
        Search
      </Label>
      <InputGroup className="min-w-0 flex-1 md:max-w-sm">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id={searchId}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          value={query}
          placeholder={placeholder}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </InputGroup>
      {filterLabel && filter && onFilterChange && options ? (
        <div className="flex max-w-[45%] shrink-0 md:max-w-none">
          <Select
            items={options.map((option) => ({ value: option.value, label: option.label }))}
            value={filter}
            onValueChange={(value) => {
              if (value) onFilterChange(value)
            }}
          >
            <SelectTrigger className="w-full min-w-32 md:w-48" aria-label={filterLabel}>
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
