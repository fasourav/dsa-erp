import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib"
import QRCode from "qrcode"

import { contentFloorMm } from "@/lib/documents/drafts"
import type { PrintDocument } from "@/lib/documents/present"

const mm = (value: number) => (value * 72) / 25.4
const pageWidth = mm(210)
const pageHeight = mm(297)
const side = mm(12)
const ink = rgb(0.12, 0.14, 0.12)
const muted = rgb(0.35, 0.38, 0.33)
const rule = rgb(0.75, 0.77, 0.72)
const headerFill = rgb(0.93, 0.94, 0.9)
const band = rgb(69 / 255, 99 / 255, 45 / 255)
const paperWhite = rgb(1, 1, 1)

export type DocumentPdfInput = {
  document: PrintDocument
  topMm: number
  bottomMm: number
  letterhead: boolean
  watermark?: Uint8Array
  logo?: Uint8Array
}

type Cursor = {
  page: PDFPage
  y: number
}

export async function buildDocumentPdf(input: DocumentPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const watermark = input.watermark ? await embedPng(pdf, input.watermark) : null
  const logo = input.logo ? await embedPng(pdf, input.logo) : null
  const top = mm(clampMargin(input.topMm))
  const bottomMm = clampMargin(input.bottomMm)
  const signLine = signatureLineY(bottomMm)
  const contentBottom = signLine + mm(18)
  const width = pageWidth - side * 2

  const addPage = () => {
    const page = pdf.addPage([pageWidth, pageHeight])
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: paperWhite })
    if (input.letterhead) drawLetterhead(page, watermark, logo, regular, bold)
    return page
  }

  const cursor: Cursor = { page: addPage(), y: pageHeight - top }

  const ensure = (height: number) => {
    if (cursor.y - height >= contentBottom) return
    cursor.page = addPage()
    cursor.y = pageHeight - top
  }

  cursor.y = drawHeader(cursor.page, input.document, regular, bold, cursor.y, width)
  cursor.y -= 8
  drawParties(cursor, input.document, regular, bold, width, ensure)
  drawFacts(cursor, input.document, regular, bold, width, ensure)
  if (input.document.intro.trim()) {
    drawWrapped(cursor, input.document.intro, regular, 9, ink, width, side, ensure)
    cursor.y -= 6
  }
  if (input.document.lines.length > 0) {
    drawLineTable(cursor, input.document, regular, bold, width, ensure)
  }
  drawTotals(cursor, input.document, regular, bold, width, ensure)
  drawProse(cursor, input.document, regular, bold, width, ensure)
  if (cursor.y < contentBottom) {
    cursor.page = addPage()
  }
  drawSignatures(cursor.page, input.document, regular, bold, signLine)
  return pdf.save()
}

async function embedPng(pdf: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  try {
    return await pdf.embedPng(bytes)
  } catch {
    return null
  }
}

function drawParties(
  cursor: Cursor,
  document: PrintDocument,
  regular: PDFFont,
  bold: PDFFont,
  width: number,
  ensure: (height: number) => void,
) {
  if (document.parties.length === 0) return
  const parties = document.parties.slice(0, 4)
  const columns = Math.min(2, parties.length)
  const gap = 8
  const colWidth = (width - gap * (columns - 1)) / columns
  const blockHeight = 52
  const rows = Math.ceil(parties.length / columns)
  ensure(rows * (blockHeight + 6))
  parties.forEach((party, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = side + column * (colWidth + gap)
    const topY = cursor.y - row * (blockHeight + 6)
    box(cursor.page, x, topY - blockHeight, colWidth, blockHeight)
    cursor.page.drawText(pdfText(party.heading).toUpperCase(), {
      x: x + 6,
      y: topY - 14,
      size: 8,
      font: bold,
      color: muted,
    })
    cursor.page.drawText(clipLine(pdfText(party.name), bold, 10, colWidth - 12), {
      x: x + 6,
      y: topY - 28,
      size: 10,
      font: bold,
      color: ink,
    })
    const detail = pdfText(party.detail).split("\n")[0] ?? ""
    if (detail) {
      cursor.page.drawText(clipLine(detail, regular, 8, colWidth - 12), {
        x: x + 6,
        y: topY - 40,
        size: 8,
        font: regular,
        color: muted,
      })
    }
  })
  cursor.y -= rows * (blockHeight + 6)
}

function drawFacts(
  cursor: Cursor,
  document: PrintDocument,
  regular: PDFFont,
  bold: PDFFont,
  width: number,
  ensure: (height: number) => void,
) {
  if (document.facts.length === 0) return
  const height = 16 + document.facts.length * 12
  ensure(height + 8)
  box(cursor.page, side, cursor.y - height, width, height)
  cursor.page.drawText("DETAILS", { x: side + 6, y: cursor.y - 12, size: 8, font: bold, color: muted })
  document.facts.forEach((fact, index) => {
    const rowY = cursor.y - 26 - index * 12
    cursor.page.drawText(clipLine(pdfText(fact.label), regular, 8, width * 0.36), {
      x: side + 6,
      y: rowY,
      size: 8,
      font: regular,
      color: muted,
    })
    cursor.page.drawText(clipLine(pdfText(fact.value), regular, 8, width * 0.55), {
      x: side + width * 0.4,
      y: rowY,
      size: 8,
      font: regular,
      color: ink,
    })
  })
  cursor.y -= height + 8
}

function drawLineTable(
  cursor: Cursor,
  document: PrintDocument,
  regular: PDFFont,
  bold: PDFFont,
  width: number,
  ensure: (height: number) => void,
) {
  const columns = [mm(12), width - mm(12 + 18 + 16 + 28 + 26), mm(18), mm(16), mm(28), mm(26)]
  const headers = ["S/L", "Item", "Qty", "Unit", "Price", "Total"]
  const paintHead = () => {
    ensure(18)
    let x = side
    headers.forEach((label, index) => {
      cursor.page.drawText(label, { x: x + 2, y: cursor.y - 11, size: 8, font: bold, color: muted })
      x += columns[index] ?? 0
    })
    cursor.page.drawLine({
      start: { x: side, y: cursor.y - 15 },
      end: { x: side + width, y: cursor.y - 15 },
      thickness: 0.4,
      color: rule,
    })
    cursor.y -= 18
  }
  paintHead()
  document.lines.forEach((lineItem, index) => {
    const item = pdfText(
      [lineItem.section, lineItem.item, lineItem.specification].filter(Boolean).join(" · "),
    )
    const itemLines = wrap(item.split(/\s+/).filter(Boolean), regular, 8, (columns[1] ?? 80) - 4)
    const rowHeight = Math.max(14, itemLines.length * 10 + 4)
    const pageBefore = cursor.page
    ensure(rowHeight)
    if (cursor.page !== pageBefore) paintHead()
    const values = [
      String(index + 1).padStart(2, "0"),
      "",
      pdfText(lineItem.quantity),
      pdfText(lineItem.unit),
      pdfText(lineItem.unitPrice),
      pdfText(lineItem.total),
    ]
    let x = side
    values.forEach((value, column) => {
      if (column !== 1 && value) {
        cursor.page.drawText(clipLine(value, regular, 8, (columns[column] ?? 20) - 4), {
          x: x + 2,
          y: cursor.y - 11,
          size: 8,
          font: regular,
          color: ink,
        })
      }
      x += columns[column] ?? 0
    })
    itemLines.forEach((text, lineIndex) => {
      cursor.page.drawText(text, {
        x: side + (columns[0] ?? 0) + 2,
        y: cursor.y - 11 - lineIndex * 10,
        size: 8,
        font: regular,
        color: ink,
      })
    })
    cursor.y -= rowHeight
  })
  cursor.y -= 6
}

function drawTotals(
  cursor: Cursor,
  document: PrintDocument,
  regular: PDFFont,
  bold: PDFFont,
  width: number,
  ensure: (height: number) => void,
) {
  if (document.summary.length === 0 && !document.words) return
  const boxHeight = Math.max(36, 20 + document.summary.length * 12)
  ensure(boxHeight + 8)
  const wordsWidth = width * 0.56
  box(cursor.page, side, cursor.y - boxHeight, wordsWidth - 6, boxHeight)
  cursor.page.drawText(pdfText(document.wordsLabel).toUpperCase(), {
    x: side + 6,
    y: cursor.y - 12,
    size: 8,
    font: bold,
    color: muted,
  })
  const wordLines = wrap(pdfText(document.words).split(/\s+/).filter(Boolean), regular, 8, wordsWidth - 18)
  wordLines.slice(0, 3).forEach((text, index) => {
    cursor.page.drawText(text, {
      x: side + 6,
      y: cursor.y - 26 - index * 10,
      size: 8,
      font: regular,
      color: ink,
    })
  })
  document.summary.forEach((row, index) => {
    const rowY = cursor.y - 14 - index * 12
    const font = row.strong ? bold : regular
    cursor.page.drawText(clipLine(pdfText(row.label), font, 8, width * 0.26), {
      x: side + wordsWidth,
      y: rowY,
      size: 8,
      font,
      color: ink,
    })
    const amount = pdfText(row.deduct ? `(${row.amount})` : row.amount)
    cursor.page.drawText(amount, {
      x: side + width - font.widthOfTextAtSize(amount, 8),
      y: rowY,
      size: 8,
      font,
      color: ink,
    })
  })
  cursor.y -= boxHeight + 8
}

function drawProse(
  cursor: Cursor,
  document: PrintDocument,
  regular: PDFFont,
  bold: PDFFont,
  width: number,
  ensure: (height: number) => void,
) {
  const blocks: Array<[string, string]> = []
  if (document.milestones.length > 0) {
    blocks.push([
      document.milestonesTitle || "Schedule",
      document.milestones.map((item) => `${item.label}  ${item.percent}  ${item.amount}`).join("\n"),
    ])
  }
  if (document.terms.trim()) blocks.push(["Terms & Conditions", document.terms])
  if (document.exclusions.trim()) blocks.push(["Exclusions", document.exclusions])
  if (document.notes.trim()) blocks.push(["Notes", document.notes])
  for (const [title, body] of blocks) {
    ensure(16)
    cursor.page.drawText(pdfText(title).toUpperCase(), {
      x: side,
      y: cursor.y - 10,
      size: 8,
      font: bold,
      color: muted,
    })
    cursor.y -= 14
    drawWrapped(cursor, body, regular, 8, ink, width, side, ensure)
    cursor.y -= 6
  }
}

function drawWrapped(
  cursor: Cursor,
  text: string,
  font: PDFFont,
  size: number,
  color: typeof ink,
  maxWidth: number,
  x: number,
  ensure: (height: number) => void,
) {
  for (const paragraph of pdfText(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    const lines = words.length === 0 ? [""] : wrap(words, font, size, maxWidth)
    for (const row of lines) {
      ensure(size + 3)
      cursor.page.drawText(row, { x, y: cursor.y - size, size, font, color })
      cursor.y -= size + 2
    }
  }
}

function drawHeader(
  page: PDFPage,
  document: PrintDocument,
  regular: PDFFont,
  bold: PDFFont,
  y: number,
  width: number,
): number {
  const pad = 8
  const qrSize = document.verifyUrl ? mm(16) : 0
  const qrGap = document.verifyUrl ? 8 : 0
  const qrX = side + width - pad - qrSize
  const textX = side + pad
  const textWidth = Math.max(40, qrX - qrGap - textX)
  const number = fitLines(
    `${pdfText(document.numberLabel)} ${pdfText(document.documentNo)}`.trim(),
    regular,
    textWidth,
  )
  const title = clipLine(pdfText(document.title), bold, 13, textWidth)
  const date = fitLines(`Date ${pdfText(document.issuedOn)}`, regular, textWidth)
  const numberBlock = number.lines.length * (number.size + 3)
  const dateBlock = date.lines.length * (date.size + 3)
  const height = Math.max(58, pad + 12 + 18 + numberBlock + dateBlock + pad, qrSize + pad * 2)
  page.drawRectangle({
    x: side,
    y: y - height,
    width,
    height,
    color: headerFill,
    borderColor: rule,
    borderWidth: 0.6,
  })
  page.drawText(pdfText(document.kicker).toUpperCase(), {
    x: textX,
    y: y - 16,
    size: 8,
    font: bold,
    color: band,
  })
  page.drawText(title, {
    x: textX,
    y: y - 34,
    size: 13,
    font: bold,
    color: ink,
  })
  let metaY = y - 48
  for (const line of number.lines) {
    page.drawText(line, { x: textX, y: metaY, size: number.size, font: regular, color: ink })
    metaY -= number.size + 3
  }
  for (const line of date.lines) {
    page.drawText(line, { x: textX, y: metaY, size: date.size, font: regular, color: muted })
    metaY -= date.size + 3
  }
  if (document.verifyUrl) drawQr(page, document.verifyUrl, qrX, y - pad - qrSize)
  return y - height
}

function signatureLineY(bottomMm: number): number {
  const textBelowLine = mm(14)
  return mm(contentFloorMm(bottomMm)) + textBelowLine
}

function drawSignatures(
  page: PDFPage,
  document: PrintDocument,
  regular: PDFFont,
  bold: PDFFont,
  lineY: number,
) {
  const signs = document.signatures.slice(0, 4)
  if (signs.length === 0) return
  const width = pageWidth - side * 2
  const gap = 8
  const col = (width - gap * (signs.length - 1)) / signs.length
  signs.forEach((signature, index) => {
    const x = side + index * (col + gap)
    page.drawLine({
      start: { x, y: lineY },
      end: { x: x + col, y: lineY },
      thickness: 0.6,
      color: rule,
    })
    page.drawText(clipLine(pdfText(signature.label).toUpperCase(), bold, 7, col - 2), {
      x,
      y: lineY - 12,
      size: 7,
      font: bold,
      color: muted,
    })
    let textY = lineY - 23
    if (signature.name.trim()) {
      page.drawText(clipLine(pdfText(signature.name), regular, 8, col - 2), {
        x,
        y: textY,
        size: 8,
        font: regular,
        color: ink,
      })
      textY -= 11
    }
    const detail = pdfText(signature.detail).split("\n")[0] ?? ""
    if (detail) {
      page.drawText(clipLine(detail, regular, 7, col - 2), {
        x,
        y: textY,
        size: 7,
        font: regular,
        color: muted,
      })
    }
  })
}

function drawLetterhead(
  page: PDFPage,
  watermark: PDFImage | null,
  logo: PDFImage | null,
  regular: PDFFont,
  bold: PDFFont,
) {
  if (watermark) {
    page.drawImage(watermark, {
      x: mm(-51.8),
      y: pageHeight + mm(2) - mm(120),
      width: mm(99.3),
      height: mm(120),
      opacity: 0.15,
    })
  }
  const slab = mm(25.6)
  page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: slab, color: band })
  page.drawRectangle({ x: mm(161.7), y: slab, width: mm(36.1), height: mm(20.4), color: band })
  const white = rgb(1, 1, 1)
  const lines = [
    { text: "DYNAMICSPACE ARCHITECTS & ENGINEERS", font: bold, size: 8 },
    { text: "H42, R5, E, Banasree, Rampura, Dhaka-1219, Bangladesh", font: regular, size: 7 },
    { text: "+8801841 84 88 31 | studio.dynamicspace.bd@gmail.com", font: regular, size: 7 },
    { text: "www.studiodynamicspace.com", font: regular, size: 7 },
  ]
  lines.forEach((row, index) => {
    page.drawText(row.text, { x: mm(11), y: mm(15) - index * mm(3.4), size: row.size, font: row.font, color: white })
  })
  if (logo) {
    const mark = mm(16)
    page.drawImage(logo, { x: mm(171.5), y: mm(16), width: mark, height: mark * (1002 / 829) })
  }
  page.drawText("DYNAMICSPACE", { x: mm(164.5), y: mm(10), size: 6, font: bold, color: white })
  page.drawText("ARCHITECTS & ENGINEERS", { x: mm(163.2), y: mm(6.2), size: 4.5, font: regular, color: white })
}

function box(page: PDFPage, x: number, y: number, width: number, height: number) {
  page.drawRectangle({ x, y, width, height, borderColor: rule, borderWidth: 0.5, color: paperWhite })
}

function drawQr(page: PDFPage, url: string, x: number, y: number) {
  const code = QRCode.create(url, { errorCorrectionLevel: "M" })
  const size = code.modules.size
  const cell = mm(16) / size
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      if (!code.modules.get(column, row)) continue
      page.drawRectangle({
        x: x + column * cell,
        y: y + (size - 1 - row) * cell,
        width: cell,
        height: cell,
        color: ink,
      })
    }
  }
}

function fitLines(
  text: string,
  font: PDFFont,
  maxWidth: number,
): { size: number; lines: string[] } {
  const sizes = [8, 7.5, 7, 6.5, 6]
  for (const size of sizes) {
    const lines = wrapToWidth(text, font, size, maxWidth)
    if (lines.length <= 3 && lines.every((line) => font.widthOfTextAtSize(line, size) <= maxWidth + 0.2)) {
      return { size, lines }
    }
  }
  return { size: 6, lines: wrapToWidth(text, font, 6, maxWidth) }
}

function wrapToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return [text || ""]
  const chunks = text.split(/(?<=[/-])/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  const pushPiece = (piece: string) => {
    let rest = piece
    while (rest && font.widthOfTextAtSize(rest, size) > maxWidth) {
      let count = rest.length
      while (count > 1 && font.widthOfTextAtSize(rest.slice(0, count), size) > maxWidth) count -= 1
      lines.push(rest.slice(0, count))
      rest = rest.slice(count)
    }
    current = rest
  }
  for (const chunk of chunks) {
    const next = current + chunk
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = ""
    pushPiece(chunk)
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [text]
}

function wrap(words: string[], font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next
      continue
    }
    if (current) lines.push(current)
    current = word
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [""]
}

function clipLine(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let clipped = text
  while (clipped.length > 1 && font.widthOfTextAtSize(`${clipped}...`, size) > maxWidth) {
    clipped = clipped.slice(0, -1)
  }
  return `${clipped}...`
}

function pdfText(value: string): string {
  return value
    .replaceAll("৳", "Tk ")
    .replaceAll("–", "-")
    .replaceAll("—", "-")
    .replaceAll("’", "'")
    .replaceAll("‘", "'")
    .replaceAll("“", '"')
    .replaceAll("”", '"')
    .replace(/[^\u0000-\u00ff]/g, "?")
}

function clampMargin(value: number): number {
  if (!Number.isFinite(value)) return 28
  return Math.min(80, Math.max(0, value))
}
