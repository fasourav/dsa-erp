import { formatCompactBdt } from "@/lib/dashboard-metrics"
import { formatGroupedCount } from "@/lib/format"
import { reportCompanyName } from "@/lib/reports/catalog"
import type { BuiltReport, ExportKind, ReportRow } from "@/lib/reports/types"

export type ListExportColumn = {
  header: string
  kind: ExportKind
}

export type ListExportGrid = {
  filename: string
  title: string
  columns: ListExportColumn[]
  rows: Array<Array<string | number | null>>
}

const MONEY_FORMAT = "#,##,##0.00"
const INTEGER_FORMAT = "#,##,##0"

export function safeFilename(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
  return cleaned || "export"
}

export function displayCell(value: string | number | null, kind: ExportKind): string {
  if (value == null || value === "") return "—"
  if (typeof value === "number") {
    if (kind === "money") return formatCompactBdt(value)
    if (kind === "integer") return formatGroupedCount(value)
  }
  return String(value)
}

export function pdfAmount(value: number): string {
  return formatCompactBdt(value).replaceAll("৳", "BDT ")
}

export function guardSheetText(value: string): string {
  if (/^[=+\-@]/.test(value)) return `'${value}`
  return value
}

export async function buildListWorkbook(grid: ListExportGrid): Promise<Uint8Array> {
  const ExcelJS = await loadExcel()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = reportCompanyName
  const sheet = workbook.addWorksheet(sheetName(grid.title), {
    views: [{ state: "frozen", ySplit: 1 }],
  })
  sheet.addRow(grid.columns.map((column) => column.header))
  const header = sheet.getRow(1)
  header.font = { bold: true }
  header.alignment = { vertical: "middle" }

  for (const source of grid.rows) {
    const row = sheet.addRow(
      grid.columns.map((column, index) => excelValue(source[index] ?? null, column.kind)),
    )
    grid.columns.forEach((column, index) => {
      const cell = row.getCell(index + 1)
      if (typeof cell.value === "number") {
        cell.numFmt = column.kind === "integer" ? INTEGER_FORMAT : MONEY_FORMAT
        cell.alignment = { horizontal: "right" }
      }
    })
  }

  sheet.columns.forEach((column, index) => {
    const headerText = grid.columns[index]?.header ?? ""
    column.width = Math.min(40, Math.max(14, headerText.length + 4))
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

export async function buildReportWorkbook(report: BuiltReport): Promise<Uint8Array> {
  const ExcelJS = await loadExcel()
  const workbook = new ExcelJS.Workbook()
  workbook.creator = reportCompanyName
  const sheet = workbook.addWorksheet(sheetName(report.title), {
    views: [{ state: "frozen", ySplit: 5 }],
  })

  const company = sheet.addRow([reportCompanyName])
  const title = sheet.addRow([report.title])
  sheet.addRow([report.periodLabel])
  company.font = { bold: true }
  title.font = { bold: true, size: 16 }

  report.tables.forEach((table, tableIndex) => {
    if (tableIndex === 0) {
      const lead = sheet.addRow(report.tables.length > 1 ? [table.title] : [])
      if (report.tables.length > 1) lead.font = { bold: true }
    } else {
      sheet.addRow([])
      const section = sheet.addRow([table.title])
      section.font = { bold: true }
    }
    const header = sheet.addRow(table.columns.map((column) => column.header))
    header.font = { bold: true }
    for (const source of table.rows) {
      writeReportRow(sheet, table.columns, source)
    }
  })

  if (report.notes.length > 0) {
    sheet.addRow([])
    for (const note of report.notes) {
      sheet.addRow([note])
    }
  }

  const width = Math.max(...report.tables.map((table) => table.columns.length), 1)
  for (let index = 1; index <= width; index += 1) {
    const column = sheet.getColumn(index)
    const headerText = report.tables[0]?.columns[index - 1]?.header ?? "Line"
    column.width = Math.min(42, Math.max(16, headerText.length + 6))
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return new Uint8Array(buffer)
}

function writeReportRow(
  sheet: import("exceljs").Worksheet,
  columns: BuiltReport["tables"][number]["columns"],
  source: ReportRow,
) {
  const row = sheet.addRow(
    columns.map((column, index) => excelValue(source.cells[index] ?? null, column.kind)),
  )
  columns.forEach((column, index) => {
    const cell = row.getCell(index + 1)
    if (typeof cell.value === "number") {
      cell.numFmt = column.kind === "integer" ? INTEGER_FORMAT : MONEY_FORMAT
      cell.alignment = { horizontal: "right" }
    }
  })
  if (source.emphasis !== "plain") {
    row.font = { bold: true }
  }
}

function excelValue(value: string | number | null, kind: ExportKind): string | number | null {
  if (value == null) return null
  if (typeof value === "number" && (kind === "money" || kind === "integer")) {
    return value
  }
  return guardSheetText(String(value))
}

type ExcelApi = {
  Workbook: new () => import("exceljs").Workbook
}

export async function loadExcel(): Promise<ExcelApi> {
  const imported = (await import("exceljs")) as unknown as ExcelApi & {
    default?: ExcelApi
  }
  if (typeof imported.Workbook === "function") return imported
  if (imported.default && typeof imported.default.Workbook === "function") {
    return imported.default
  }
  throw new Error("Could not load the spreadsheet library.")
}

function sheetName(title: string): string {
  const cleaned = title.replace(/[\\/*?:[\]]/g, " ").trim()
  return (cleaned || "Report").slice(0, 31)
}

export function parseListGrid(value: unknown): ListExportGrid | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const body = value as Record<string, unknown>
  if (typeof body.filename !== "string" || typeof body.title !== "string") return null
  if (!Array.isArray(body.columns) || !Array.isArray(body.rows)) return null
  if (body.columns.length === 0 || body.columns.length > 40 || body.rows.length > 20000) {
    return null
  }

  const columns: ListExportColumn[] = []
  for (const column of body.columns) {
    if (!column || typeof column !== "object" || Array.isArray(column)) return null
    const header = (column as { header?: unknown }).header
    const kind = (column as { kind?: unknown }).kind
    if (typeof header !== "string" || header.trim() === "" || header.length > 80) return null
    if (kind !== "text" && kind !== "money" && kind !== "integer") return null
    columns.push({ header: header.trim(), kind })
  }

  const rows: Array<Array<string | number | null>> = []
  for (const source of body.rows) {
    if (!Array.isArray(source) || source.length !== columns.length) return null
    const row: Array<string | number | null> = []
    for (let index = 0; index < columns.length; index += 1) {
      const cell = source[index]
      const kind = columns[index].kind
      if (cell == null || cell === "") {
        row.push(null)
        continue
      }
      if (kind === "text") {
        if (typeof cell !== "string" && typeof cell !== "number") return null
        row.push(String(cell).slice(0, 500))
        continue
      }
      if (typeof cell === "number" && Number.isFinite(cell)) {
        row.push(cell)
        continue
      }
      if (cell === "Hidden") {
        row.push("Hidden")
        continue
      }
      return null
    }
    rows.push(row)
  }

  return {
    filename: safeFilename(body.filename),
    title: body.title.trim().slice(0, 120) || "Export",
    columns,
    rows,
  }
}
