"use client"

import { SlidersHorizontal } from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
  const searchParams = useSearchParams()
  const years = reportYears(launch, today)
  const matched = years.find((year) => {
    const period = periodForYear(year, launch, today)
    return period.from === from && period.to === to
  })
  const [year, setYear] = useState(matched ? String(matched) : "custom")
  const [start, setStart] = useState(from)
  const [end, setEnd] = useState(to)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const yearItems = [
    ...years.map((value) => ({ value: String(value), label: String(value) })),
    { value: "custom", label: "Custom" },
  ]

  function openPeriod(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("from", nextFrom)
    params.set("to", nextTo)
    setFiltersOpen(false)
    router.push(`${pathname}?${params.toString()}`)
  }

  function chooseYear(value: string | null) {
    const next = value ?? "custom"
    setYear(next)
    if (next === "custom") return
    const period = periodForYear(Number(next), launch, today)
    setStart(period.from)
    setEnd(period.to)
    openPeriod(period.from, period.to)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    openPeriod(start, end)
  }

  return (
    <>
      <div className="px-1 md:hidden">
        <Button type="button" variant="outline" onClick={() => setFiltersOpen(true)}>
          <SlidersHorizontal aria-hidden="true" data-icon="inline-start" />
          Filters
        </Button>
      </div>
      <form className="hidden flex-wrap items-center gap-2 md:flex" onSubmit={submit}>
        <PeriodFields
          idPrefix="report-bar"
          capsule
          year={year}
          yearItems={yearItems}
          start={start}
          end={end}
          launch={launch}
          today={today}
          onYear={chooseYear}
          onStart={(value) => {
            setYear("custom")
            setStart(value)
          }}
          onEnd={(value) => {
            setYear("custom")
            setEnd(value)
          }}
        />
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>
      <Dialog open={filtersOpen} onOpenChange={setFiltersOpen}>
        <DialogContent className="overflow-hidden sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
            <DialogBody className="flex flex-col gap-4">
              <PeriodFields
                idPrefix="report-sheet"
                capsule={false}
                year={year}
                yearItems={yearItems}
                start={start}
                end={end}
                launch={launch}
                today={today}
                onYear={chooseYear}
                onStart={(value) => {
                  setYear("custom")
                  setStart(value)
                }}
                onEnd={(value) => {
                  setYear("custom")
                  setEnd(value)
                }}
              />
            </DialogBody>
            <DialogFooter>
              <Button type="submit">Apply</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PeriodFields({
  idPrefix,
  capsule,
  year,
  yearItems,
  start,
  end,
  launch,
  today,
  onYear,
  onStart,
  onEnd,
}: {
  idPrefix: string
  capsule: boolean
  year: string
  yearItems: Array<{ value: string; label: string }>
  start: string
  end: string
  launch: string
  today: string
  onYear: (value: string | null) => void
  onStart: (value: string) => void
  onEnd: (value: string) => void
}) {
  return (
    <>
      <div className="flex min-w-0 flex-col gap-2">
        <Label
          htmlFor={`${idPrefix}-year`}
          className={capsule ? "sr-only" : "text-label text-muted-foreground"}
        >
          Year
        </Label>
        <Select items={yearItems} value={year} onValueChange={onYear}>
          <SelectTrigger
            id={`${idPrefix}-year`}
            variant={capsule ? "capsule" : "field"}
            className={capsule ? "min-w-32" : "w-full"}
          >
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
      <div className="flex min-w-0 flex-col gap-2">
        <Label
          htmlFor={`${idPrefix}-from`}
          className={capsule ? "sr-only" : "text-label text-muted-foreground"}
        >
          From
        </Label>
        <Input
          id={`${idPrefix}-from`}
          type="date"
          min={launch}
          max={today}
          value={start}
          className={capsule ? "md:w-40" : undefined}
          onChange={(event) => onStart(event.target.value)}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <Label
          htmlFor={`${idPrefix}-to`}
          className={capsule ? "sr-only" : "text-label text-muted-foreground"}
        >
          To
        </Label>
        <Input
          id={`${idPrefix}-to`}
          type="date"
          min={launch}
          max={today}
          value={end}
          className={capsule ? "md:w-40" : undefined}
          onChange={(event) => onEnd(event.target.value)}
        />
      </div>
    </>
  )
}
