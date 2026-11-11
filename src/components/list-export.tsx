"use client"

import { Download } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { deliverFile, XLSX_MIME } from "@/lib/deliver-file"
import { buildListWorkbook, parseListGrid, type ListExportGrid } from "@/lib/reports/workbook"

export type ListExportLoaderResult = {
  grid?: ListExportGrid | null
  error?: string | null
}

type ListExportProps =
  | {
      grid: ListExportGrid
      loadGrid?: never
    }
  | {
      loadGrid: () => Promise<ListExportLoaderResult>
      grid?: never
    }

export function ListExport(props: ListExportProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function resolveGrid(): Promise<ListExportGrid | null> {
    if (props.grid) {
      return props.grid
    }
    const result = await props.loadGrid()
    if (result.error || !result.grid) {
      setError(result.error || "Could not export this list.")
      return null
    }
    return result.grid
  }

  async function downloadCsv() {
    setError(null)
    setPending(true)
    try {
      const grid = await resolveGrid()
      if (!grid) return
      const lines = [
        grid.columns.map((column) => csvCell(column.header)).join(","),
        ...grid.rows.map((row) =>
          row
            .map((cell, index) => csvCell(cell, grid.columns[index]?.kind === "text"))
            .join(","),
        ),
      ]
      const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
        type: "text/csv;charset=utf-8",
      })
      await deliverFile(blob, `${grid.filename}.csv`, { navigateOnIos: false })
    } catch {
      setError("Could not export this list.")
    } finally {
      setPending(false)
    }
  }

  async function downloadExcel() {
    setError(null)
    setPending(true)
    try {
      const grid = await resolveGrid()
      if (!grid) return
      const parsed = parseListGrid(grid)
      if (!parsed) {
        setError("Could not export this list.")
        return
      }
      const filename = `${grid.filename}.xlsx`
      try {
        const bytes = await buildListWorkbook(parsed)
        await deliverFile(new Blob([bytes as BlobPart], { type: XLSX_MIME }), filename, {
          navigateOnIos: false,
        })
        return
      } catch {
        const response = await fetch("/reports/list-export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(grid),
        })
        if (!response.ok) {
          setError("Could not export this list.")
          return
        }
        await deliverFile(await response.blob(), filename, { navigateOnIos: false })
      }
    } catch {
      setError("Could not export this list.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) void import("exceljs")
        }}
      >
        <DropdownMenuTrigger
          render={
            <Button type="button" variant="outline" disabled={pending} />
          }
        >
          <Download aria-hidden="true" data-icon="inline-start" />
          Export
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => void downloadExcel()}>Excel</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void downloadCsv()}>CSV</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function csvCell(value: string | number | null, textual = true): string {
  if (value == null) return ""
  if (typeof value === "number" && !textual) return String(value)
  const text = String(value)
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  if (/[",\r\n]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`
  return safe
}
