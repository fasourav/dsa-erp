import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import { reportCompanyName } from "@/lib/reports/catalog"
import type { BuiltReport, ExportKind, ReportTable } from "@/lib/reports/types"
import { pdfAmount } from "@/lib/reports/workbook"
import { formatGroupedCount } from "@/lib/format"

const margin = 40
const ink = rgb(0.12, 0.12, 0.12)
const muted = rgb(0.38, 0.38, 0.38)

export async function buildReportPdf(report: BuiltReport): Promise<Uint8Array> {
  const document = await PDFDocument.create()
  document.setTitle(`${report.title} · ${reportCompanyName}`)
  document.setAuthor(reportCompanyName)
  const regular = await document.embedFont(StandardFonts.Helvetica)
  const bold = await document.embedFont(StandardFonts.HelveticaBold)
  const size: [number, number] = report.landscape ? [841.89, 595.28] : [595.28, 841.89]
  const cursor = new Cursor(document, size, regular, bold, report)

  for (const [index, table] of report.tables.entries()) {
    if (index > 0) cursor.gap(16)
    cursor.section(table)
  }

  cursor.gap(14)
  for (const note of report.notes) {
    cursor.paragraph(note, 9, muted, regular)
    cursor.gap(6)
  }

  cursor.finish()
  return document.save()
}

class Cursor {
  private page: PDFPage
  private y: number
  private readonly width: number
  private readonly height: number

  constructor(
    private readonly document: PDFDocument,
    private readonly size: [number, number],
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
    private readonly report: BuiltReport,
  ) {
    this.width = size[0]
    this.height = size[1]
    this.page = document.addPage(size)
    this.y = this.height - margin
    this.heading(true)
  }

  section(table: ReportTable) {
    if (this.report.tables.length > 1) {
      this.paragraph(table.title, 12, ink, this.bold)
      this.gap(8)
    }
    const widths = columnWidths(table, this.width - margin * 2)
    this.drawRow(
      table.columns.map((column) => column.header),
      widths,
      table.columns.map((column) => column.kind),
      true,
    )
    for (const row of table.rows) {
      this.drawRow(
        row.cells.map((cell, index) => printable(cell, table.columns[index].kind)),
        widths,
        table.columns.map((column) => column.kind),
        row.emphasis !== "plain",
      )
    }
  }

  gap(amount: number) {
    this.ensure(amount)
    this.y -= amount
  }

  paragraph(text: string, size: number, color: ReturnType<typeof rgb>, font: PDFFont) {
    const lines = wrap(text, font, size, this.width - margin * 2)
    for (const line of lines) {
      this.ensure(size + 4)
      this.page.drawText(line, { x: margin, y: this.y - size, size, font, color })
      this.y -= size + 4
    }
  }

  finish() {
    const pages = this.document.getPages()
    pages.forEach((page, index) => {
      const label = `Page ${index + 1} of ${pages.length}`
      const width = this.regular.widthOfTextAtSize(label, 8)
      page.drawText(label, {
        x: this.width - margin - width,
        y: 22,
        size: 8,
        font: this.regular,
        color: muted,
      })
    })
  }

  private heading(first: boolean) {
    this.paragraph(reportCompanyName, 10, muted, this.regular)
    this.gap(4)
    this.paragraph(this.report.title, 16, ink, this.bold)
    this.gap(2)
    this.paragraph(this.report.periodLabel, 10, muted, this.regular)
    this.gap(first ? 16 : 12)
  }

  private drawRow(cells: string[], widths: number[], kinds: ExportKind[], strong: boolean) {
    const font = strong ? this.bold : this.regular
    const wrapped = cells.map((cell, index) => wrap(cell, font, 9, widths[index] - 8))
    const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length))
    const height = lineCount * 12 + 8
    this.ensure(height + 8)
    let x = margin
    wrapped.forEach((lines, index) => {
      const alignRight = kinds[index] !== "text"
      lines.forEach((line, lineIndex) => {
        const textWidth = font.widthOfTextAtSize(line, 9)
        const textX = alignRight ? x + widths[index] - 4 - textWidth : x + 4
        this.page.drawText(line, {
          x: textX,
          y: this.y - 14 - lineIndex * 12,
          size: 9,
          font,
          color: ink,
        })
      })
      x += widths[index]
    })
    this.y -= height
    this.page.drawLine({
      start: { x: margin, y: this.y },
      end: { x: this.width - margin, y: this.y },
      thickness: strong ? 0.8 : 0.3,
      color: muted,
    })
  }

  private ensure(needed: number) {
    if (this.y - needed >= margin + 18) return
    this.page = this.document.addPage(this.size)
    this.y = this.height - margin
    this.heading(false)
  }
}

function printable(value: string | number | null, kind: ExportKind): string {
  if (value == null || value === "") return "—"
  if (typeof value === "number") {
    if (kind === "money") return pdfAmount(value)
    if (kind === "integer") return formatGroupedCount(value)
  }
  return String(value)
}

function columnWidths(table: ReportTable, total: number): number[] {
  const weights = table.columns.map((column) => {
    if (column.kind === "money") return 1.3
    if (column.kind === "integer") return 0.8
    if (column.header === "Notes" || column.header === "Reference" || column.header === "Line") {
      return 2.2
    }
    return 1.5
  })
  const sum = weights.reduce((totalWeight, weight) => totalWeight + weight, 0)
  return weights.map((weight) => (total * weight) / sum)
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const source = text.replace(/\s+/g, " ").trim() || "—"
  const words = source.split(" ")
  const lines: string[] = []
  let current = ""

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
    while (font.widthOfTextAtSize(current, size) > width && current.length > 1) {
      let cut = current.length - 1
      while (cut > 1 && font.widthOfTextAtSize(current.slice(0, cut), size) > width) {
        cut -= 1
      }
      lines.push(current.slice(0, cut))
      current = current.slice(cut)
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 8)
}
