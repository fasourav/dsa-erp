"use client"

import { useMemo, useState } from "react"

import { ListExport } from "@/components/list-export"
import { filterRows, ListSearch, rowText } from "@/components/list-search"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type ActivityRow = {
  id: string
  when: string
  whenIso: string
  who: string
  what: string
  action: string
  module: string
  moduleLabel: string
  changes: string[]
}

export function ActivityLog({ rows }: { rows: ActivityRow[] }) {
  const [query, setQuery] = useState("")
  const [module, setModule] = useState("all")
  const [user, setUser] = useState("all")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const moduleOptions = useMemo(() => {
    const labels = new Map<string, string>()
    for (const row of rows) labels.set(row.module, row.moduleLabel)
    return [...labels.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [rows])

  const userOptions = useMemo(() => {
    return [...new Set(rows.map((row) => row.who))].sort((a, b) => a.localeCompare(b))
  }, [rows])

  const filtered = filterRows(rows, query, (row) =>
    rowText({
      when: row.when,
      who: row.who,
      what: row.what,
      action: row.action,
      module: row.moduleLabel,
      changes: row.changes.join(" "),
    }),
  ).filter((row) => {
    if (module !== "all" && row.module !== module) return false
    if (user !== "all" && row.who !== user) return false
    if (from && row.whenIso < from) return false
    if (to && row.whenIso > to) return false
    return true
  })

  return (
    <div className="flex flex-col gap-4">
      <ListExport
        grid={{
          filename: "activity-log",
          title: "Activity Log",
          columns: [
            { header: "When", kind: "text" },
            { header: "Who", kind: "text" },
            { header: "What", kind: "text" },
            { header: "Module", kind: "text" },
          ],
          rows: filtered.map((row) => [row.when, row.who, row.what, row.moduleLabel]),
        }}
      />
      <ListSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Search activity"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          label="Module"
          value={module}
          onChange={setModule}
          options={[{ value: "all", label: "All Modules" }, ...moduleOptions]}
        />
        <FilterSelect
          label="User"
          value={user}
          onChange={setUser}
          options={[
            { value: "all", label: "All Users" },
            ...userOptions.map((name) => ({ value: name, label: name })),
          ]}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="activity-from">From</Label>
          <Input
            id="activity-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="activity-to">To</Label>
          <Input
            id="activity-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>
      <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>What</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="py-8 text-center whitespace-normal text-muted-foreground">
                  No Activity Yet.
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="py-8 text-center whitespace-normal text-muted-foreground">
                  No matching activity.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{row.when}</TableCell>
                  <TableCell>{row.who}</TableCell>
                  <TableCell className="whitespace-normal">
                    <div className="flex flex-col gap-1">
                      <span>{row.what}</span>
                      {row.changes.map((change, index) => (
                        <span key={`${row.id}-${index}`} className="text-muted-foreground">
                          {change}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>
      <Select
        items={options}
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next)
        }}
      >
        <SelectTrigger className="w-full" aria-label={label}>
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
  )
}
