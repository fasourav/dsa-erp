"use client"

import { usePathname, useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { periodForYear, reportYears } from "@/lib/reports/period"

export function ReportFilters({
  launch,
  today,
  from,
  to,
}: {
  launch: string
  today: string
  from: string
  to: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const years = reportYears(launch, today)
  const matched = years.find((year) => {
    const period = periodForYear(year, launch, today)
    return period.from === from && period.to === to
  })
  const [year, setYear] = useState(matched ? String(matched) : "custom")
  const [start, setStart] = useState(from)
  const [end, setEnd] = useState(to)
  const yearItems = [
    ...years.map((value) => ({ value: String(value), label: String(value) })),
    { value: "custom", label: "Custom" },
  ]

  function openPeriod(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams({ from: nextFrom, to: nextTo })
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        openPeriod(start, end)
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="report-year">Year</Label>
          <Select
            items={yearItems}
            value={year}
            onValueChange={(value) => {
              const next = value ?? "custom"
              setYear(next)
              if (next === "custom") return
              const period = periodForYear(Number(next), launch, today)
              setStart(period.from)
              setEnd(period.to)
              openPeriod(period.from, period.to)
            }}
          >
            <SelectTrigger id="report-year" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start">
              {yearItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="report-from">From</Label>
          <Input
            id="report-from"
            type="date"
            min={launch}
            max={today}
            value={start}
            onChange={(event) => {
              setYear("custom")
              setStart(event.target.value)
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="report-to">To</Label>
          <Input
            id="report-to"
            type="date"
            min={launch}
            max={today}
            value={end}
            onChange={(event) => {
              setYear("custom")
              setEnd(event.target.value)
            }}
          />
        </div>
      </div>
      <Button type="submit" variant="outline" className="w-full sm:w-fit">
        Apply
      </Button>
    </form>
  )
}
