"use client"

import { Download, FileSpreadsheet } from "lucide-react"
import { useMemo, useState } from "react"

import { ReportFilters } from "@/app/(app)/reports/report-filters"
import { DataList } from "@/components/data-list"
import { Money } from "@/components/money"
import { PageHeader, SectionHeader } from "@/components/page-header"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { deliverFile, XLSX_MIME } from "@/lib/deliver-file"
import { compareText } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"
import { buildReportWorkbook, displayCell } from "@/lib/reports/workbook"
import type { BuiltReport, Emphasis, ExportKind, ReportTable } from "@/lib/reports/types"
import { cn } from "@/lib/utils"

type Figure = {
  label: string
  amount: number
  detail?: string
}

type ReportLine = {
  id: string
  cells: Array<string | number | null>
  sortValues?: Array<string | number | null | undefined>
  emphasis: Emphasis
}

export function ReportView({
  report,
  pdfHref,
  excelHref,
  excelFilename,
  launch,
  today,
  from,
  to,
  showFilters = true,
}: {
  report: BuiltReport
  pdfHref: string
  excelHref: string
  excelFilename: string
  launch: string
  today: string
  from: string
  to: string
  showFilters?: boolean
}) {
  const [excelPending, setExcelPending] = useState(false)
  const figures = summaryFigures(report)
  const listed = report.tables.filter((table) => !isBucketSummary(table))
  const tables = listed.length > 0 ? listed : report.tables

  async function downloadExcel() {
    setExcelPending(true)
    try {
      const bytes = await buildReportWorkbook(report)
      await deliverFile(new Blob([bytes as BlobPart], { type: XLSX_MIME }), excelFilename, {
        navigateOnIos: false,
      })
    } catch {
      window.location.assign(excelHref)
    } finally {
      setExcelPending(false)
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <PageHeader
        className="mb-0 md:mb-2"
        breadcrumbs={[
          { label: "Reports", href: "/reports" },
          { label: report.title },
        ]}
        eyebrow={<span className="md:hidden">Reports</span>}
        title={report.title}
        description={report.periodLabel}
        actions={
          <>
            <a href={pdfHref} className={buttonVariants({ variant: "outline" })}>
              <Download aria-hidden="true" data-icon="inline-start" />
              PDF
            </a>
            <Button
              type="button"
              variant="outline"
              disabled={excelPending}
              onClick={() => void downloadExcel()}
            >
              <FileSpreadsheet aria-hidden="true" data-icon="inline-start" />
              {excelPending ? "Creating…" : "Excel"}
            </Button>
          </>
        }
      />
      {showFilters ? <ReportFilters launch={launch} today={today} from={from} to={to} /> : null}
      {figures.length > 0 ? (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
          {figures.map((figure) => (
            <Card
              key={`${figure.label}-${figure.amount}`}
              className="min-w-0 gap-0 px-4 py-4 last:odd:col-span-2 md:px-5 md:py-4 md:last:odd:col-span-1"
            >
              <p className="truncate text-label text-muted-foreground">{figure.label}</p>
              <p className={cn("mt-1.5 truncate text-metric md:text-kpi", figure.amount < 0 && "text-destructive")}>
                <Money value={figure.amount} size="kpi" />
              </p>
              {figure.detail ? (
                <p className="mt-1 truncate text-caption text-muted-foreground">{figure.detail}</p>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}
      {tables.map((table) => (
        <section key={table.title} className="flex flex-col">
          {tables.length > 1 ? (
            <SectionHeader title={table.title} className="pt-2 md:mt-2 md:mb-2" />
          ) : null}
          <ReportTable table={table} />
        </section>
      ))}
      {report.notes.map((note) => (
        <p key={note} className="px-1 text-label text-muted-foreground">
          {note}
        </p>
      ))}
    </div>
  )
}

function ReportTable({ table }: { table: ReportTable }) {
  const columns = useMemo<ListColumn<string>[]>(
    () =>
      table.columns.map((column, index) => ({
        id: `c${index}`,
        label: column.header,
        align: column.kind === "text" ? "left" : "right",
        locked: true,
      })),
    [table.columns],
  )
  const lines = useMemo<ReportLine[]>(
    () =>
      table.rows.map((row, index) => ({
        id: `${table.title}-${index}`,
        cells: row.cells,
        sortValues: row.sortValues,
        emphasis: row.emphasis,
      })),
    [table.rows, table.title],
  )
  const [sort, setSort] = useState<SortState<string>>({ key: "c0", direction: "asc" })
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => sortLines(lines, table, sort), [lines, sort, table])
  const pageResult = paginateRows(sorted, page)

  return (
    <DataList
      columns={columns}
      rows={pageResult.rows}
      rowKey={(row) => row.id}
      sort={sort}
      onSort={(id) => {
        setSort((current) => toggleSort(current, id))
        setPage(1)
      }}
      visibility={{}}
      error={null}
      emptyMessage="No Rows In This Period."
      rangeText={rangeLabel(pageResult.rangeStart, pageResult.rangeEnd, pageResult.total, "row", "rows")}
      currentPage={pageResult.currentPage}
      pageCount={pageResult.pageCount}
      onPageChange={setPage}
      pagingLabel={`${table.title} pagination`}
      mobileItem={(row) => mobileLine(table, row)}
      renderCell={(row, columnId) => renderLineCell(table, row, columnId)}
    />
  )
}

function isBucketSummary(table: ReportTable) {
  return table.columns.some((column) => column.header === "Bucket")
}

function summaryFigures(report: BuiltReport): Figure[] {
  const figures: Figure[] = []
  const seen = new Set<string>()

  function add(label: string, amount: number, detail?: string) {
    const key = `${label}:${amount}`
    if (seen.has(key)) return
    seen.add(key)
    figures.push({ label, amount, detail })
  }

  const summary = report.tables.find(isBucketSummary)
  if (summary) {
    const moneyIndex = summary.columns.findIndex((column) => column.kind === "money")
    const countIndex = summary.columns.findIndex((column) => column.kind === "integer")
    const countHeader = countIndex >= 0 ? summary.columns[countIndex]?.header : undefined
    for (const row of summary.rows) {
      const label = row.cells[0]
      const amount = moneyIndex >= 0 ? row.cells[moneyIndex] : null
      const count = countIndex >= 0 ? row.cells[countIndex] : null
      if (typeof label !== "string" || typeof amount !== "number") continue
      add(
        label,
        amount,
        typeof count === "number" && countHeader
          ? `${displayCell(count, "integer")} ${countHeader}`
          : undefined,
      )
    }
    return figures
  }

  const statement = report.tables.find(
    (table) =>
      table.columns.length === 2 &&
      table.columns[0]?.kind === "text" &&
      table.columns[1]?.kind === "money",
  )
  if (statement) {
    const emphasized = statement.rows.filter((row) => row.emphasis !== "plain")
    const source = emphasized.length > 0 ? emphasized : statement.rows.slice(-1)
    for (const row of source) {
      const label = row.cells[0]
      const amount = row.cells[1]
      if (typeof label === "string" && typeof amount === "number") add(label, amount)
    }
    return figures
  }

  for (const table of report.tables) {
    const total = [...table.rows].reverse().find((row) => row.emphasis === "total")
    if (!total) continue
    const moneyColumns = table.columns.filter((column) => column.kind === "money")
    table.columns.forEach((column, index) => {
      if (column.kind !== "money") return
      const amount = total.cells[index]
      if (typeof amount !== "number") return
      const label =
        moneyColumns.length === 1 && column.header === "Amount" ? table.title : column.header
      add(label, amount)
    })
    break
  }

  return figures
}

function sortLines(lines: ReportLine[], table: ReportTable, sort: SortState<string>) {
  const index = Number(sort.key.slice(1))
  const column = table.columns[index]
  const kind = column?.kind ?? "text"
  const sortAs = column?.sortAs
  const direction = sort.direction === "asc" ? 1 : -1
  const body = lines.filter((line) => line.emphasis === "plain")
  const foot = lines.filter((line) => line.emphasis !== "plain")
  body.sort((left, right) => {
    if (sortAs === "date") {
      const leftIso =
        typeof left.sortValues?.[index] === "string" ? left.sortValues[index].trim() : ""
      const rightIso =
        typeof right.sortValues?.[index] === "string" ? right.sortValues[index].trim() : ""
      if (!leftIso && rightIso) return 1
      if (leftIso && !rightIso) return -1
      if (leftIso && rightIso) {
        const cmp = leftIso.localeCompare(rightIso)
        if (cmp !== 0) return cmp * direction
      }
      return compareCell(left.cells[index], right.cells[index], kind) * direction
    }
    const result = compareCell(left.cells[index], right.cells[index], kind)
    return result * direction
  })
  return [...body, ...foot]
}

function compareCell(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  kind: ExportKind,
) {
  if (kind === "money" || kind === "integer") {
    const a = typeof left === "number" ? left : Number.NEGATIVE_INFINITY
    const b = typeof right === "number" ? right : Number.NEGATIVE_INFINITY
    return a - b
  }
  return compareText(String(left ?? ""), String(right ?? ""))
}

function renderLineCell(table: ReportTable, row: ReportLine, columnId: string) {
  const index = Number(columnId.slice(1))
  const kind = table.columns[index]?.kind ?? "text"
  const value = row.cells[index] ?? null
  const strong = row.emphasis !== "plain"
  if (kind === "money" && typeof value === "number") {
    return (
      <span className={cn(strong && "font-medium", value < 0 && "text-destructive")}>
        <Money value={value} />
      </span>
    )
  }
  return (
    <span className={cn(strong && "font-medium", kind !== "text" && "tabular-nums")}>
      {displayCell(value, kind)}
    </span>
  )
}

function mobileLine(table: ReportTable, row: ReportLine) {
  const texts: string[] = []
  const monies: number[] = []
  let integer: number | null = null
  row.cells.forEach((cell, index) => {
    const kind = table.columns[index]?.kind ?? "text"
    if (kind === "money" && typeof cell === "number") {
      monies.push(cell)
      return
    }
    if (kind === "integer" && typeof cell === "number") {
      integer = cell
      return
    }
    if (cell != null && String(cell).trim()) texts.push(String(cell))
  })
  const amount = monies[0]
  const extra = monies.length > 1 ? monies[monies.length - 1] : null
  return {
    title: texts[0] || "—",
    subtitle: texts.slice(1).join(" · ") || undefined,
    value: typeof amount === "number" ? <Money value={amount} /> : undefined,
    meta:
      typeof extra === "number" ? (
        <Money value={extra} />
      ) : integer != null ? (
        displayCell(integer, "integer")
      ) : undefined,
  }
}
