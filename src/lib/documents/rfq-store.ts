import zlib from "node:zlib"

import type { SupabaseClient } from "@supabase/supabase-js"
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib"

import { SIGNATURE_OFF } from "@/lib/documents/drafts"
import { blankBody, type FormBody, type RfqRow } from "@/lib/documents/form-model"
import type { DocumentListItem } from "@/lib/documents/queries"
import { formatIsoDate } from "@/lib/format"
import { isUuid } from "@/lib/ids"
import { createClient } from "@/lib/supabase/server"

// External RFQ: only the document number and the generated PDF are stored.
// Files are kept for 30 days after they are created, then removed by the daily cron.

export const RFQ_BUCKET = "rfq-files"
export const RFQ_FILE_DAYS = 30
const RFQ_META_PREFIX = "dsa-erp-rfq:"

const unavailable = "RFQ storage is not available until the external RFQ migration is applied."

export type RfqStoredDraft = {
  issuedOn: string
  body: FormBody
}

export type RfqRecord = {
  id: string
  documentNo: string
  createdAt: string
  fileCreatedAt: string
  fileExpiresAt: string
  /** False once the file expired or was removed. */
  hasFile: boolean
  issuedOn: string
  body: FormBody | null
}

function missingTable(error: { message?: string; code?: string } | null): boolean {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`
  return /42P01|PGRST205|schema cache|does not exist|Could not find the table/i.test(text)
}

function fileAlive(storagePath: string | null, expiresAt: string): boolean {
  return Boolean(storagePath) && Date.parse(expiresAt) > Date.now()
}

/** Revision of an RFQ number: `...-V3` or `...-V3-2` is 3, a number without -V is 1. */
export function rfqRevision(documentNo: string): number {
  const match = /-V(\d+)(?:-\d+)?$/.exec(documentNo.trim())
  const value = match ? Number(match[1]) : 1
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 1
}

export function rfqStoragePath(rfqId: string, fileId: string): string {
  return `${rfqId}/${fileId}.pdf`
}

export function rfqFileExpiry(from: Date): string {
  return new Date(from.getTime() + RFQ_FILE_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export function issuedOnFromDocumentNo(documentNo: string): string {
  const match = /\/(\d{2})(\d{2})(\d{4})(?:-|$)/.exec(documentNo.trim())
  return match ? `${match[3]}-${match[2]}-${match[1]}` : ""
}

function sanitizeRfqLines(raw: unknown): RfqRow[] {
  if (!Array.isArray(raw)) {
    return [{ item: "", specification: "", unit: "", quantity: "", remarks: "" }]
  }
  const rows: RfqRow[] = raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object")
    .map((entry) => ({
      item: typeof entry.item === "string" ? entry.item : "",
      specification: typeof entry.specification === "string" ? entry.specification : "",
      unit: typeof entry.unit === "string" ? entry.unit : "",
      quantity: typeof entry.quantity === "string" ? entry.quantity : "",
      remarks: typeof entry.remarks === "string" ? entry.remarks : "",
    }))
  return rows.length ? rows : [{ item: "", specification: "", unit: "", quantity: "", remarks: "" }]
}

export function sanitizeRfqBody(raw: Partial<FormBody> | null | undefined): FormBody {
  const base = blankBody()
  base.subtitle = "Vendor / Service Provider"
  if (!raw || typeof raw !== "object") return base
  const str = (key: keyof FormBody, fallback = "") =>
    typeof raw[key] === "string" ? (raw[key] as string) : fallback
  return {
    ...base,
    subtitle: str("subtitle", "Vendor / Service Provider") || "Vendor / Service Provider",
    preparedBy: str("preparedBy"),
    checkedBy: str("checkedBy"),
    authorizedBy: str("authorizedBy"),
    submittedBy: str("submittedBy"),
    partyName: str("partyName"),
    partyDetail: str("partyDetail"),
    companyName: str("companyName"),
    projectName: str("projectName"),
    dueOn: str("dueOn"),
    startDate: str("startDate"),
    completionDate: str("completionDate"),
    subject: str("subject"),
    intro: str("intro"),
    notes: str("notes"),
    terms: str("terms"),
    rfqLines: sanitizeRfqLines(raw.rfqLines),
  }
}

export function sameRfqDraft(a: RfqStoredDraft, b: RfqStoredDraft): boolean {
  if (a.issuedOn.trim() !== b.issuedOn.trim()) return false
  const left = sanitizeRfqBody(a.body)
  const right = sanitizeRfqBody(b.body)
  const keys = [
    "subtitle",
    "preparedBy",
    "checkedBy",
    "authorizedBy",
    "submittedBy",
    "partyName",
    "partyDetail",
    "companyName",
    "projectName",
    "dueOn",
    "startDate",
    "completionDate",
    "subject",
    "intro",
    "notes",
    "terms",
  ] as const
  for (const key of keys) {
    if (left[key].trim() !== right[key].trim()) return false
  }
  const leftLines = left.rfqLines.filter((line) => line.item.trim())
  const rightLines = right.rfqLines.filter((line) => line.item.trim())
  if (leftLines.length !== rightLines.length) return false
  return leftLines.every((line, index) => {
    const other = rightLines[index]
    return (
      Boolean(other) &&
      line.item.trim() === other.item.trim() &&
      line.specification.trim() === other.specification.trim() &&
      line.quantity.trim() === other.quantity.trim() &&
      line.unit.trim() === other.unit.trim() &&
      line.remarks.trim() === other.remarks.trim()
    )
  })
}

export async function embedRfqDraftInPdf(pdf: Uint8Array, draft: RfqStoredDraft): Promise<Uint8Array> {
  try {
    const doc = await PDFDocument.load(pdf)
    const payload = {
      issuedOn: draft.issuedOn,
      body: sanitizeRfqBody(draft.body),
    }
    doc.setSubject(RFQ_META_PREFIX + Buffer.from(JSON.stringify(payload), "utf8").toString("base64"))
    return new Uint8Array(await doc.save())
  } catch {
    return pdf
  }
}

export async function extractRfqDraftFromPdf(
  pdf: Uint8Array,
  fallbackIssuedOn: string,
): Promise<RfqStoredDraft | null> {
  try {
    const doc = await PDFDocument.load(pdf)
    const subject = doc.getSubject() ?? ""
    if (subject.startsWith(RFQ_META_PREFIX)) {
      const json = Buffer.from(subject.slice(RFQ_META_PREFIX.length), "base64").toString("utf8")
      const parsed = JSON.parse(json) as { issuedOn?: string; body?: Partial<FormBody> } | null
      if (parsed && typeof parsed === "object" && parsed.body) {
        return {
          issuedOn:
            typeof parsed.issuedOn === "string" && parsed.issuedOn ? parsed.issuedOn : fallbackIssuedOn,
          body: sanitizeRfqBody(parsed.body),
        }
      }
    }
    return parseLegacyRfqFromPdf(doc, fallbackIssuedOn)
  } catch {
    return null
  }
}

type PdfLine = {
  mcid: number
  x: number
  startX: number
  lastX: number
  y: number
  fontSize: number
  text: string
}

const monthMap: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
}

function parseDmyToIso(value: string): string {
  const trimmed = value.trim()
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  if (iso) return trimmed
  const dmy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  const mon = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(trimmed)
  if (mon) {
    const mm = monthMap[(mon[2] ?? "").toLowerCase()]
    if (mm) return `${mon[3]}-${mm}-${String(mon[1]).padStart(2, "0")}`
  }
  return ""
}

function decodeHexUtf16OrUtf8(hex: string): string {
  const clean = hex.replace(/\s+/g, "")
  if (!clean) return ""
  const bytes = Buffer.from(clean, "hex")
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let out = ""
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      out += String.fromCharCode(((bytes[i] ?? 0) << 8) | (bytes[i + 1] ?? 0))
    }
    return out
  }
  let chars = ""
  for (let i = 0; i < clean.length; i += 4) {
    const code = Number.parseInt(clean.slice(i, i + 4), 16)
    if (Number.isFinite(code)) chars += String.fromCodePoint(code)
  }
  return chars
}

function decodePdfLiteral(raw: string): string {
  const bytes: number[] = []
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]
    if (ch !== "\\") {
      bytes.push(raw.charCodeAt(i) & 0xff)
      continue
    }
    i += 1
    if (i >= raw.length) break
    const next = raw[i] ?? ""
    if (next === "n") bytes.push(10)
    else if (next === "r") bytes.push(13)
    else if (next === "t") bytes.push(9)
    else if (next === "b") bytes.push(8)
    else if (next === "f") bytes.push(12)
    else if (next === "(") bytes.push(40)
    else if (next === ")") bytes.push(41)
    else if (next === "\\") bytes.push(92)
    else if (next >= "0" && next <= "7") {
      let oct = next
      if (i + 1 < raw.length && (raw[i + 1] ?? "") >= "0" && (raw[i + 1] ?? "") <= "7") {
        i += 1
        oct += raw[i] ?? ""
        if (i + 1 < raw.length && (raw[i + 1] ?? "") >= "0" && (raw[i + 1] ?? "") <= "7") {
          i += 1
          oct += raw[i] ?? ""
        }
      }
      bytes.push(Number.parseInt(oct, 8) & 0xff)
    } else {
      bytes.push(raw.charCodeAt(i) & 0xff)
    }
  }
  const buf = Buffer.from(bytes)
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    let out = ""
    for (let i = 2; i + 1 < buf.length; i += 2) {
      out += String.fromCharCode(((buf[i] ?? 0) << 8) | (buf[i + 1] ?? 0))
    }
    return out
  }
  return buf.toString("utf8")
}

function parseCMap(text: string): Map<number, string> {
  const map = new Map<number, string>()
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const match of (block[1] ?? "").matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const code = Number.parseInt(match[1] ?? "", 16)
      map.set(code, decodeHexUtf16OrUtf8(match[2] ?? ""))
    }
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const match of (block[1] ?? "").matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g,
    )) {
      const start = Number.parseInt(match[1] ?? "", 16)
      const end = Number.parseInt(match[2] ?? "", 16)
      if (match[3] !== undefined) {
        let dst = Number.parseInt(match[3], 16)
        for (let code = start; code <= end; code += 1) {
          map.set(code, String.fromCodePoint(dst))
          dst += 1
        }
      } else if (match[4] !== undefined) {
        const items = Array.from(match[4].matchAll(/<([0-9A-Fa-f]+)>/g), (m) => m[1] ?? "")
        for (let i = 0; i < items.length && start + i <= end; i += 1) {
          map.set(start + i, decodeHexUtf16OrUtf8(items[i] ?? ""))
        }
      }
    }
  }
  return map
}

function collectLines(
  context: PDFDocument["context"],
  resourcesObj: unknown,
  contentsObj: unknown,
  lines: PdfLine[],
): void {
  const resources = resourcesObj ? context.lookup(resourcesObj as never) : null
  const fontDict =
    resources instanceof PDFDict ? context.lookup(resources.get(PDFName.of("Font"))) : null
  const fontMaps = new Map<string, Map<number, string>>()
  if (fontDict instanceof PDFDict) {
    for (const [key, val] of fontDict.entries()) {
      const fontName = key.toString().replace(/^\//, "")
      const fontObj = context.lookup(val)
      if (fontObj instanceof PDFDict) {
        const toUnicode = context.lookup(fontObj.get(PDFName.of("ToUnicode")))
        if (toUnicode instanceof PDFRawStream) {
          try {
            const cmapStr = zlib.inflateSync(toUnicode.contents).toString("latin1")
            fontMaps.set(fontName, parseCMap(cmapStr))
          } catch {
            // Skip unreadable font stream.
          }
        }
      }
    }
  }

  const xObjectDict =
    resources instanceof PDFDict ? context.lookup(resources.get(PDFName.of("XObject"))) : null
  if (xObjectDict instanceof PDFDict) {
    for (const [, val] of xObjectDict.entries()) {
      const xObj = context.lookup(val)
      if (xObj instanceof PDFRawStream) {
        const subResources = xObj.dict.get(PDFName.of("Resources"))
        if (subResources) {
          collectLines(context, subResources, xObj, lines)
        }
      }
    }
  }

  const contents = contentsObj ? context.lookup(contentsObj as never) : null
  const streams =
    contents instanceof PDFArray
      ? contents.asArray().map((ref) => context.lookup(ref))
      : [contents]

  let mcidOffset = lines.length * 100000
  for (const stream of streams) {
    if (!(stream instanceof PDFRawStream)) continue
    let contentStr = ""
    try {
      contentStr = zlib.inflateSync(stream.contents).toString("latin1")
    } catch {
      continue
    }
    let currentMcid = -1
    const tokenRegex = /<<\/MCID\s*(\d+)\s*>>\s*BDC|BT([\s\S]*?)ET/g
    for (const topMatch of contentStr.matchAll(tokenRegex)) {
      if (topMatch[1] !== undefined) {
        currentMcid = Number.parseInt(topMatch[1], 10) + mcidOffset
        continue
      }
      const block = topMatch[2] ?? ""
      let currentFont = ""
      let fontSize = 0
      let x = 0
      let y = 0
      let startX: number | null = null
      let lastX = 0
      let text = ""
      let actualText: string | null = null
      let actualTextUsed = false

      for (const token of block.matchAll(
        /\/Span\s*<<[^>]*?\/ActualText\s*(?:<([0-9A-Fa-f\s]+)>|\(((?:\\.|[^\\)])*)\))\s*>>\s*BDC|EMC|\/(F\d+)\s+([-\d.]+)\s+Tf|([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+Tm|([-\d.]+)\s+([-\d.]+)\s+Td|<([0-9A-Fa-f]+)>\s*Tj|\[([\s\S]*?)\]\s*TJ/g,
      )) {
        if (token[1] !== undefined || token[2] !== undefined) {
          actualText =
            token[1] !== undefined ? decodeHexUtf16OrUtf8(token[1]) : decodePdfLiteral(token[2] ?? "")
          actualTextUsed = false
        } else if (token[0] === "EMC") {
          actualText = null
          actualTextUsed = false
        } else if (token[3]) {
          currentFont = token[3]
          fontSize = Number.parseFloat(token[4] ?? "0")
        } else if (token[9] !== undefined && token[10] !== undefined) {
          x = Number.parseFloat(token[9])
          y = Number.parseFloat(token[10])
        } else if (token[11] !== undefined && token[12] !== undefined) {
          x += Number.parseFloat(token[11])
          y += Number.parseFloat(token[12])
        } else if (token[13] !== undefined || token[14] !== undefined) {
          let decoded = ""
          if (actualText !== null) {
            if (!actualTextUsed) {
              decoded = actualText
              actualTextUsed = true
            }
          } else {
            const cmap = fontMaps.get(currentFont)
            if (cmap) {
              const hexes =
                token[13] !== undefined
                  ? [token[13]]
                  : Array.from((token[14] ?? "").matchAll(/<([0-9A-Fa-f]+)>/g), (m) => m[1] ?? "")
              for (const hex of hexes) {
                for (let i = 0; i < hex.length; i += 4) {
                  const code = Number.parseInt(hex.slice(i, i + 4), 16)
                  decoded += cmap.get(code) ?? ""
                }
              }
              decoded = decoded.replace(/[\uE000-\uF8FF]/g, "")
            }
          }
          if (decoded) {
            if (startX === null) startX = x
            lastX = x
            text += decoded
          }
        }
      }
      if (text && startX !== null) {
        const prev = lines[lines.length - 1]
        if (
          prev &&
          prev.mcid !== -1 &&
          prev.mcid === currentMcid &&
          Math.abs(prev.y - y) < 1.5 &&
          Math.abs(prev.fontSize - fontSize) < 0.5 &&
          startX >= prev.lastX - 1 &&
          startX - prev.lastX < 18
        ) {
          prev.text += text
          prev.lastX = lastX
        } else {
          lines.push({ mcid: currentMcid, x: startX, startX, lastX, y, fontSize, text })
        }
      }
    }
    mcidOffset += 100000
  }
}

function joinPdfLines(lines: PdfLine[], lineStep = 17): string {
  if (!lines.length) return ""
  let out = lines[0]?.text.trim() ?? ""
  for (let i = 1; i < lines.length; i += 1) {
    const prev = lines[i - 1]!
    const curr = lines[i]!
    const txt = curr.text.trim()
    if (!txt) continue
    if (curr.mcid !== -1 && curr.mcid === prev.mcid) {
      if (out.endsWith("-") && /^[a-z]/.test(txt)) {
        out += txt
      } else {
        out += ` ${txt}`
      }
    } else {
      const dy = curr.y - prev.y
      const breaks = dy >= lineStep * 1.6 ? Math.min(4, Math.max(2, Math.round(dy / lineStep))) : 1
      out += "\n".repeat(breaks) + txt
    }
  }
  return out
}

function parseLegacyRfqFromPdf(doc: PDFDocument, fallbackIssuedOn: string): RfqStoredDraft | null {
  const pageCount = doc.getPageCount()
  if (pageCount === 0) return null

  const allPageLines: PdfLine[][] = []
  for (let p = 0; p < pageCount; p += 1) {
    const page = doc.getPage(p)
    const lines: PdfLine[] = []
    collectLines(
      doc.context,
      page.node.get(PDFName.of("Resources")),
      page.node.get(PDFName.of("Contents")),
      lines,
    )
    allPageLines.push(lines)
  }
  if (!allPageLines[0]?.length) return null

  const p0Lines = allPageLines[0]
  let issuedOn = fallbackIssuedOn
  let subtitle = "Vendor / Service Provider"
  let partyName = ""
  const partyDetailLines: PdfLine[] = []
  let companyName = ""
  let projectName = ""
  let dueOn = ""
  let startDate = ""
  let completionDate = ""
  let subject = ""
  const introPdfLines: PdfLine[] = []
  const notePdfLines: PdfLine[] = []
  const termsPdfLines: PdfLine[] = []
  const rfqLines: RfqRow[] = []

  const dateLine = p0Lines.find((l) => l.x < 300 && /^Date:\s*/i.test(l.text.trim()))
  if (dateLine) {
    const parsedDate = parseDmyToIso(dateLine.text.replace(/^Date:\s*/i, "").trim())
    if (parsedDate) issuedOn = parsedDate
  }
  const titleLine = p0Lines.find((l) => l.x > 350 && /REQUEST FOR QUOTATION/i.test(l.text))
  if (titleLine) {
    const subLine = p0Lines.find(
      (l) => l.x > 350 && l.y > titleLine.y + 5 && l.y < titleLine.y + 35 && l.fontSize < 13,
    )
    if (subLine?.text.trim()) subtitle = subLine.text.trim()
  }

  const toHeader = p0Lines.find((l) => l.x < 200 && l.text.trim().toUpperCase() === "TO")
  const detailsHeader = p0Lines.find((l) => l.x > 350 && /RFQ DETAILS/i.test(l.text))
  const subjectLabel = p0Lines.find((l) => l.x < 150 && l.text.trim().toUpperCase() === "SUBJECT")
  const tableHeaderP0 = p0Lines.find((l) => l.x < 120 && l.text.trim() === "S/L")
  const thanksP0 = p0Lines.find((l) => l.x < 250 && /^Thanks\s*&\s*Regards/i.test(l.text.trim()))

  const cardsBottomY = Math.min(
    subjectLabel ? subjectLabel.y - 5 : Number.POSITIVE_INFINITY,
    tableHeaderP0 ? tableHeaderP0.y - 5 : Number.POSITIVE_INFINITY,
    thanksP0 ? thanksP0.y - 5 : Number.POSITIVE_INFINITY,
    260,
  )

  if (toHeader) {
    const leftCardLines = p0Lines.filter(
      (l) => l.x < 400 && l.y > toHeader.y + 5 && l.y < cardsBottomY,
    )
    for (const line of leftCardLines) {
      const txt = line.text.trim()
      if (!txt || txt === "\u2014" || txt === "-") continue
      if (!partyName && line.fontSize >= 11.8) {
        partyName = txt
      } else {
        partyDetailLines.push(line)
      }
    }
  }

  if (detailsHeader) {
    const rightLabels = p0Lines.filter(
      (l) => l.x >= 400 && l.x < 538 && l.y > detailsHeader.y + 5 && l.y < cardsBottomY + 20,
    )
    const rightValues = p0Lines.filter(
      (l) => l.x >= 538 && l.y > detailsHeader.y + 5 && l.y < cardsBottomY + 20,
    )
    for (let i = 0; i < rightLabels.length; i += 1) {
      const lbl = rightLabels[i]!
      const nextLbl = rightLabels[i + 1]
      const maxValY = nextLbl ? nextLbl.y - 3 : cardsBottomY + 20
      const val = rightValues
        .filter((v) => v.y >= lbl.y - 4 && v.y < maxValY)
        .map((v) => v.text.trim())
        .join(" ")
        .trim()
      const cleanVal = val === "\u2014" || val === "-" ? "" : val
      if (/Vendor Name/i.test(lbl.text)) companyName = cleanVal
      else if (/Project Name/i.test(lbl.text)) projectName = cleanVal
      else if (/Submission Deadline/i.test(lbl.text)) dueOn = parseDmyToIso(cleanVal)
      else if (/Tentative Work Period/i.test(lbl.text) && cleanVal) {
        const parts = cleanVal.split(/\s*[\u2013\u2014-]\s*/)
        if (parts.length === 2) {
          startDate = parseDmyToIso(parts[0] ?? "")
          completionDate = parseDmyToIso(parts[1] ?? "")
        } else if (parts.length === 1) {
          startDate = parseDmyToIso(parts[0] ?? "")
        }
      }
    }
  }

  const introEndY = tableHeaderP0
    ? tableHeaderP0.y - 8
    : thanksP0
      ? thanksP0.y - 8
      : 350

  if (subjectLabel) {
    const subjLines = p0Lines.filter(
      (l) =>
        l !== subjectLabel &&
        l.x < 500 &&
        l.y >= subjectLabel.y - 4 &&
        l.y <= introEndY &&
        l.fontSize >= 12.0,
    )
    subject = joinPdfLines(subjLines, 17)
  }

  const introStartY = subjectLabel
    ? subjectLabel.y + 12
    : Math.max(
        toHeader ? toHeader.y + 70 : 230,
        ...p0Lines.filter((l) => l.y < cardsBottomY + 15).map((l) => l.y + 12),
      )

  for (const line of p0Lines) {
    if (
      line.x < 200 &&
      line.y >= introStartY &&
      line.y <= introEndY &&
      Math.abs(line.fontSize - 11.33) < 0.8
    ) {
      introPdfLines.push(line)
    }
  }

  for (let p = 0; p < pageCount; p += 1) {
    const pLines = allPageLines[p] ?? []
    const th = pLines.find((l) => l.x < 115 && l.text.trim() === "S/L")
    const thanks = pLines.find((l) => l.x < 250 && /^Thanks\s*&\s*Regards/i.test(l.text.trim()))
    const termsHeading = pLines.find(
      (l) => l.x < 200 && /^TERMS\s*&\s*CONDITIONS$/i.test(l.text.trim()),
    )
    const foot = pLines.find((l) => l.x < 250 && /^RFQ No\./i.test(l.text.trim()))
    if (th) {
      const tableBottomY = thanks
        ? thanks.y - 4
        : termsHeading
          ? termsHeading.y - 8
          : foot
            ? foot.y - 20
            : Number.POSITIVE_INFINITY
      const bodyCells = pLines.filter((l) => l.y > th.y + 6 && l.y < tableBottomY)
      const slAnchors = bodyCells.filter(
        (l) => l.x < 110 && l.fontSize >= 10.4 && /^\d{2,}$/.test(l.text.trim()),
      )
      for (let i = 0; i < slAnchors.length; i += 1) {
        const anchor = slAnchors[i]
        if (!anchor) continue
        const rowTop = anchor.y - 3
        const nextAnchor = slAnchors[i + 1]
        const nextAnchorY = nextAnchor ? nextAnchor.y - 3 : tableBottomY
        const rowCells = bodyCells.filter(
          (l) =>
            l.y >= rowTop &&
            l.y < nextAnchorY &&
            !(l.x < 80 && Math.abs(l.fontSize - 10) < 0.4),
        )
        const itemCells = rowCells.filter(
          (l) => l.x >= 98 && l.x < 465 && l.fontSize >= 10.4,
        )
        const specCells = rowCells.filter(
          (l) => l.x >= 98 && l.x < 465 && l.fontSize < 10.4,
        )
        const qtyCells = rowCells.filter((l) => l.x >= 465 && l.x < 536.5)
        const unitCells = rowCells.filter((l) => l.x >= 536.5 && l.x < 589.5)
        const remCells = rowCells.filter((l) => l.x >= 589.5)
        rfqLines.push({
          item: joinPdfLines(itemCells, 15),
          specification: joinPdfLines(specCells, 14),
          quantity: qtyCells.map((l) => l.text.trim()).join(" "),
          unit: joinPdfLines(unitCells, 15),
          remarks: joinPdfLines(remCells, 15),
        })
      }
    }

    if (thanks) {
      const noteMinY = th ? th.y + 15 : p === 0 ? introEndY : 130
      for (const line of pLines) {
        if (
          line.x < 100 &&
          line.y > noteMinY &&
          line.y < thanks.y - 4 &&
          Math.abs(line.fontSize - 10) < 0.4
        ) {
          notePdfLines.push(line)
        }
      }
    }

    if (termsHeading) {
      const coop = pLines.find(
        (l) => l.x < 300 && /^Thank you for your cooperation/i.test(l.text.trim()),
      )
      const termsEndY = coop ? coop.y - 4 : foot ? foot.y - 20 : Number.POSITIVE_INFINITY
      for (const line of pLines) {
        if (
          line.x < 400 &&
          line.y > termsHeading.y + 4 &&
          line.y < termsEndY &&
          line.fontSize >= 10.2 &&
          line.fontSize <= 11.8 &&
          !/^\d+\.$/.test(line.text.trim())
        ) {
          termsPdfLines.push({
            ...line,
            text: line.text.trim().replace(/^\d+\.\s*/, ""),
          })
        }
      }
    }
  }

  const groupedTerms: string[] = []
  for (let i = 0; i < termsPdfLines.length; i += 1) {
    const curr = termsPdfLines[i]!
    const prev = termsPdfLines[i - 1]
    if (!curr.text) continue
    if (
      prev &&
      groupedTerms.length > 0 &&
      ((curr.mcid !== -1 && curr.mcid === prev.mcid) || curr.y - prev.y < 15.8)
    ) {
      groupedTerms[groupedTerms.length - 1] = `${groupedTerms[groupedTerms.length - 1]} ${curr.text}`
    } else {
      groupedTerms.push(curr.text)
    }
  }

  let preparedBy = SIGNATURE_OFF
  let checkedBy = SIGNATURE_OFF
  let authorizedBy = SIGNATURE_OFF
  let submittedBy = SIGNATURE_OFF

  for (let p = 0; p < pageCount; p += 1) {
    const sigLines = allPageLines[p] ?? []
    const findWho = (roleRegex: RegExp): string | null => {
      const roleLine = sigLines.find(
        (l) => Math.abs(l.fontSize - 9.06) < 0.5 && roleRegex.test(l.text.trim()),
      )
      if (!roleLine) return null
      const whoLine = sigLines.find(
        (l) =>
          Math.abs(l.x - roleLine.x) < 15 &&
          l.y > roleLine.y + 8 &&
          l.y < roleLine.y + 38 &&
          l.fontSize >= 10.6,
      )
      return whoLine ? whoLine.text.trim() : ""
    }
    const prep = findWho(/^PREPARED BY$/i)
    if (prep !== null) preparedBy = prep
    const chk = findWho(/^CHECKED BY$/i)
    if (chk !== null) checkedBy = chk
    const auth = findWho(/^AUTHORIZED SIGNATURE$/i)
    if (auth !== null) authorizedBy = auth
    const vendorSig = sigLines.find(
      (l) => Math.abs(l.fontSize - 9.06) < 0.5 && /QUOTATION SUBMITTED/i.test(l.text),
    )
    if (vendorSig) submittedBy = ""
  }

  return {
    issuedOn,
    body: sanitizeRfqBody({
      subtitle,
      partyName,
      partyDetail: joinPdfLines(partyDetailLines, 17),
      companyName: companyName || partyName,
      projectName,
      dueOn,
      startDate,
      completionDate,
      subject,
      intro: joinPdfLines(introPdfLines, 17),
      rfqLines: rfqLines.length
        ? rfqLines
        : [{ item: "", specification: "", unit: "", quantity: "", remarks: "" }],
      notes: joinPdfLines(notePdfLines, 14),
      terms: groupedTerms.join("\n"),
      preparedBy,
      checkedBy,
      authorizedBy,
      submittedBy,
    }),
  }
}

export async function listRfqDocuments(): Promise<{ items: DocumentListItem[]; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("rfq_documents")
    .select("id, document_no, created_at, storage_path, file_expires_at")
    .order("created_at", { ascending: false })
  if (error) return { items: [], error: missingTable(error) ? unavailable : "Could not load documents." }
  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: row.document_no,
      detail: [
        formatIsoDate(row.created_at.slice(0, 10)),
        fileAlive(row.storage_path, row.file_expires_at)
          ? `File until ${formatIsoDate(row.file_expires_at.slice(0, 10))}`
          : "File removed",
      ].join(" · "),
      documentNo: row.document_no,
    })),
    error: null,
  }
}

export async function loadRfqDocument(id: string): Promise<{ record: RfqRecord | null; error: string | null }> {
  if (!isUuid(id)) return { record: null, error: "That document could not be found." }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("rfq_documents")
    .select("id, document_no, created_at, storage_path, file_created_at, file_expires_at")
    .eq("id", id)
    .maybeSingle()
  if (error) return { record: null, error: missingTable(error) ? unavailable : "Could not load this document." }
  if (!data) return { record: null, error: "That document could not be found." }
  const hasFile = fileAlive(data.storage_path, data.file_expires_at)
  const fallbackIssuedOn =
    issuedOnFromDocumentNo(data.document_no) || data.file_created_at.slice(0, 10)
  let issuedOn = fallbackIssuedOn
  let body: FormBody | null = null
  if (hasFile && data.storage_path) {
    const downloaded = await supabase.storage.from(RFQ_BUCKET).download(data.storage_path)
    if (!downloaded.error && downloaded.data) {
      const pdfBytes = new Uint8Array(await downloaded.data.arrayBuffer())
      const extracted = await extractRfqDraftFromPdf(pdfBytes, fallbackIssuedOn)
      if (extracted) {
        issuedOn = extracted.issuedOn || fallbackIssuedOn
        body = extracted.body
      }
    }
  }
  return {
    record: {
      id: data.id,
      documentNo: data.document_no,
      createdAt: data.created_at,
      fileCreatedAt: data.file_created_at,
      fileExpiresAt: data.file_expires_at,
      hasFile,
      issuedOn,
      body,
    },
    error: null,
  }
}

/**
 * Removes RFQ files older than 30 days. Runs with the service role from the daily cron.
 * The row keeps its document number; only storage_path is cleared.
 */
export async function removeExpiredRfqFiles(admin: SupabaseClient): Promise<number> {
  const { data, error } = await admin
    .from("rfq_documents")
    .select("id, storage_path")
    .not("storage_path", "is", null)
    .lte("file_expires_at", new Date().toISOString())
    .limit(500)
  if (error || !data?.length) return 0
  const rows = (data as Array<{ id: string; storage_path: string | null }>).filter(
    (row): row is { id: string; storage_path: string } => Boolean(row.storage_path),
  )
  if (!rows.length) return 0
  const removal = await admin.storage.from(RFQ_BUCKET).remove(rows.map((row) => row.storage_path))
  if (removal.error) return 0
  let cleared = 0
  for (const row of rows) {
    const { error: updateError } = await admin
      .from("rfq_documents")
      .update({ storage_path: null })
      .eq("id", row.id)
      .eq("storage_path", row.storage_path)
    if (!updateError) cleared += 1
  }
  return cleared
}
