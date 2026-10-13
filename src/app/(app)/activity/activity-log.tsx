"use client"

import { useState } from "react"

import { filterRows, ListSearch, rowText } from "@/components/list-search"
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
  who: string
  what: string
  action: string
  module: string
}

export function ActivityLog({ rows }: { rows: ActivityRow[] }) {
  const [query, setQuery] = useState("")
  const filtered = filterRows(rows, query, (row) =>
    rowText({
      when: row.when,
      who: row.who,
      what: row.what,
      action: row.action,
      module: row.module,
    }),
  )

  return (
    <div className="flex flex-col gap-4">
      <ListSearch
        query={query}
        onQueryChange={setQuery}
        placeholder="Search activity"
      />
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
                  <TableCell className="whitespace-normal">{row.what}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
