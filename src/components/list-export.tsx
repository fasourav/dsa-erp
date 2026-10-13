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
import type { ListExportGrid } from "@/lib/reports/workbook"

export function ListExport({ grid }: { grid: ListExportGrid }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function downloadCsv() {
    setError(null)
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
    saveBlob(blob, `${grid.filename}.csv`)
  }

  async function downloadExcel() {
    setError(null)
    setPending(true)
    try {
      const response = await fetch("/reports/list-export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(grid),
      })
      if (!response.ok) {
        setError("Could not export this list.")
        return
      }
      saveBlob(await response.blob(), `${grid.filename}.xlsx`)
    } catch {
      setError("Could not export this list.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <DropdownMenu>
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
          <DropdownMenuItem onClick={downloadCsv}>CSV</DropdownMenuItem>
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

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function csvCell(value: string | number | null, textual = true): string {
  if (value == null) return ""
  if (typeof value === "number" && !textual) return String(value)
  const text = String(value)
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text
  if (/[",\r\n]/.test(safe)) return `"${safe.replaceAll('"', '""')}"`
  return safe
}
