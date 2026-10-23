import { formatGroupedAmount } from "@/lib/format"
import {
  clampPrintMargin,
  DEFAULT_PRINT_MARGIN_BOTTOM_MM,
  DEFAULT_PRINT_MARGIN_TOP_MM,
  type PrintMargins,
} from "@/lib/documents/drafts"
import { amountInWords } from "@/lib/documents/money"
import type { PrintDocument, PrintLine } from "@/lib/documents/present"

import { qrSvg } from "@/lib/documents/setc/qr"
import type {
  CertificateModel,
  ChallanModel,
  DocumentModel,
  LetterModel,
  SalaryModel,
  SignLine,
  VoucherModel,
} from "@/lib/documents/setc/types"

/** Nothing may sit below this line on the letterhead. */
export const LETTERHEAD_FLOOR_MM = 243

const HEAD_MM = 30
const FOOT_MM = 9
const SIGN_MM = 28

export type DocumentMode = "letterhead" | "print" | "sheet"

export type ContentBox = {
  top: number
  bottom: number
  floor: number
  height: number
}

export function contentBox(margins: PrintMargins): ContentBox {
  const bottom = clampPrintMargin(margins.bottomMm, DEFAULT_PRINT_MARGIN_BOTTOM_MM)
  const floor = Math.min(LETTERHEAD_FLOOR_MM, 297 - bottom)
  const requestedTop = clampPrintMargin(margins.topMm, DEFAULT_PRINT_MARGIN_TOP_MM)
  const top = Math.min(requestedTop, Math.max(0, floor - 40))
  return { top, bottom, floor, height: Math.max(40, floor - top) }
}

type Chunk = { html: string; mm: number }

export function renderDocument(
  model: DocumentModel,
  margins: PrintMargins,
  mode: DocumentMode,
  inlineCss?: string,
): { pages: string[]; html: string } {
  const box = contentBox(margins)
  const built = build(model, box)
  const pages = built.bodies.map((body, index) =>
    pageHtml({
      body,
      signs: index === built.bodies.length - 1 ? built.signs : "",
      ref: built.ref,
      page: index + 1,
      total: built.bodies.length,
      title: built.title,
      subtitle: built.pageSubtitles[index] ?? built.subtitle,
      refLines: built.pageRefs[index] ?? built.refLines,
      verifyUrl: built.verifyUrl,
      box,
      mode,
      documentTitle: built.title,
    }),
  )
  return { pages, html: shell(pages.join("\n"), built.title, box, mode, inlineCss) }
}

function build(model: DocumentModel, box: ContentBox): Built {
  if (model.kind === "print") return buildPrint(model.doc, box)
  if (model.kind === "challan") return buildChallan(model.doc, box)
  if (model.kind === "voucher") return buildVoucher(model.doc, box)
  if (model.kind === "certificate") return buildCertificate(model.doc, box)
  if (model.kind === "salary") return buildSalary(model.doc, box)
  return buildLetter(model.doc, box)
}

type Built = {
  title: string
  subtitle: string
  ref: string
  refLines: Array<[string, string]>
  pageRefs: Array<Array<[string, string]>>
  pageSubtitles: string[]
  verifyUrl: string | null
  bodies: string[]
  signs: string
}

function buildPrint(doc: PrintDocument, box: ContentBox): Built {
  const refLines: Array<[string, string]> = [
    [doc.numberLabel, doc.documentNo],
    ["Date", doc.issuedOn],
  ]
  const signs = signBlock(doc.signatures)
  const signReserve = doc.signatures.length ? SIGN_MM : 0
  if (doc.kicker === "Quotation") return quotation(doc, box, refLines, signs, signReserve)
  if (doc.kicker === "Work Order") return workOrder(doc, box, refLines, signs, signReserve)
  if (doc.kicker === "Purchase Order") return purchaseOrder(doc, box, refLines, signs, signReserve)
  if (doc.kicker === "Bill Invoice") return invoice(doc, box, refLines, signs, signReserve)
  return receipt(doc, box, refLines, signs, signReserve)
}

function quotation(
  doc: PrintDocument,
  box: ContentBox,
  refLines: Array<[string, string]>,
  signs: string,
  signReserve: number,
): Built {
  const groups = groupLines(doc.lines)
  const summaryRows = groups.map((group, index) => ({
    html: `<tr><td class="c">${pad(index + 1)}</td><td>${esc(group.name)}</td><td class="r">${esc(fmt(group.amount))}</td></tr>`,
    mm: 8,
  }))
  const summary = tableChunk(
    `<thead><tr><th class="c" style="width:8mm">S/L</th><th>Section</th><th class="r" style="width:34mm">Amount (৳)</th></tr></thead>`,
    summaryRows,
    summaryFooter(doc),
    18,
    box,
  )
  const schedule = doc.milestones.length
    ? chunk(
        `<div class="block"><h4>${esc(doc.milestonesTitle || "Payment Schedule")}</h4>${milestoneTable(doc)}</div>`,
        16 + doc.milestones.length * 7,
      )
    : null
  const terms = textColumns(doc.terms, "Terms & Conditions", doc.exclusions, "Exclusions")
  const page1: Chunk[] = [
    chunk(cards(doc), 34),
    ...summary,
    chunk(wordsBox(doc.wordsLabel, doc.words), 16),
  ]
  if (schedule) page1.push(schedule)
  if (terms) page1.push(terms)
  const boqRows = boqRowsOf(doc.lines)
  const boq = tableChunk(boqHead(), boqRows, boqFooter(doc), 12, box)
  const note = chunk(
    `<p class="note">I/We accept this quotation and authorize DynamicSpace Architects &amp; Engineers to proceed as per the above scope, payment schedule and terms.</p>`,
    10,
  )
  const first = flow(page1, budget(box, 0))
  const rest = flow([...boq, note], budget(box, signReserve))
  const bodies = [...first, ...rest]
  const client = doc.facts.find((fact) => fact.label === "Client Name")?.value ?? ""
  return {
    title: "Quotation",
    subtitle: doc.title,
    ref: `Quotation No. ${doc.documentNo}`,
    refLines,
    pageRefs: [
      refLines,
      [
        [doc.numberLabel, doc.documentNo],
        ["Client Name", client || "—"],
      ],
    ],
    pageSubtitles: [doc.title, "Bill Of Quantities & Terms"],
    verifyUrl: doc.verifyUrl,
    bodies: bodies.length ? bodies : [""],
    signs,
  }
}

function workOrder(
  doc: PrintDocument,
  box: ContentBox,
  refLines: Array<[string, string]>,
  signs: string,
  signReserve: number,
): Built {
  const intro = splitIntro(doc.intro)
  const rows = itemRows(doc.lines)
  const table = tableChunk(itemHead("Total Price (৳)"), rows, grandFooter(doc.summary[0]?.label ?? "Total Work Order Value", doc), 12, box)
  const page1: Chunk[] = [chunk(cards(doc), 34)]
  if (intro.subject) {
    page1.push(chunk(`<div class="subject"><span>Subject</span>${esc(intro.subject)}</div>`, 14))
  }
  if (intro.body) page1.push(chunk(`<div class="letter"><p class="intro">${esc(intro.body)}</p></div>`, estimateText(intro.body)))
  page1.push(...table, chunk(wordsBox(doc.wordsLabel, doc.words), 16), chunk(`<p class="thanks">Thanks &amp; Regards,</p>`, 6))
  const terms = listBlock(doc.terms, doc.milestonesTitle || "Terms & Conditions", true)
  const pay = doc.milestones.length
    ? chunk(
        `<div class="block tight"><h4>Payment Terms</h4>${milestoneTable(doc, true)}</div>`,
        18 + doc.milestones.length * 7,
      )
    : null
  const page2: Chunk[] = []
  if (pay) page2.push(pay)
  if (terms) page2.push(terms)
  if (page2.length) page2.push(chunk(`<p class="thanks">Thank you for your cooperation.</p>`, 6))
  const bodies = [
    ...flow(page1, budget(box, page2.length ? 0 : signReserve)),
    ...flow(page2, budget(box, signReserve)),
  ]
  return baseBuilt("Work Order", doc, refLines, bodies, signs)
}

function purchaseOrder(
  doc: PrintDocument,
  box: ContentBox,
  refLines: Array<[string, string]>,
  signs: string,
  signReserve: number,
): Built {
  const rows = itemRows(doc.lines)
  const footer = summaryFooter(doc)
  const chunks: Chunk[] = [
    chunk(cards(doc), 36),
    ...tableChunk(itemHead("Total Price (৳)"), rows, footer, 20, box),
    chunk(wordsBox(doc.wordsLabel, doc.words), 16),
  ]
  const terms = listBlock(doc.terms, "Terms & Conditions", true)
  if (terms) chunks.push(terms)
  return baseBuilt("Purchase Order", doc, refLines, flow(chunks, budget(box, signReserve)), signs)
}

function invoice(
  doc: PrintDocument,
  box: ContentBox,
  refLines: Array<[string, string]>,
  signs: string,
  signReserve: number,
): Built {
  const description = doc.lines.map((line) => line.item).filter(Boolean).join("; ") || "Final bill"
  const spec = doc.lines.map((line) => line.specification).filter(Boolean)[0] ?? ""
  const subtotal = doc.summary.find((row) => /sub total/i.test(row.label))
  const amount = subtotal?.amount ?? doc.summary.find((row) => row.strong)?.amount ?? ""
  const row = {
    html: `<tr><td class="c">01</td><td class="item">${esc(description)}${spec ? `<span class="spec">${esc(spec)}</span>` : ""}</td><td class="r">${tkSpan(amount)}</td></tr>`,
    mm: spec ? 14 : 9,
  }
  const chunks: Chunk[] = [
    chunk(cards(doc), 36),
    ...tableChunk(
      `<thead><tr><th class="c" style="width:10mm">S/L</th><th>Item</th><th class="r" style="width:36mm">Total Price</th></tr></thead>`,
      [row],
      summaryFooter(doc),
      28,
      box,
    ),
    chunk(invoiceWords(doc), doc.netWords ? 22 : 16),
  ]
  if (doc.notes.trim()) {
    chunks.push(chunk(`<div class="block"><h4>Payment</h4><p class="plain">${esc(doc.notes)}</p></div>`, 16))
  }
  chunks.push(chunk(`<p class="thanks">Thanks &amp; Regards,</p>`, 6))
  const annexRows = doc.lines.map((line, index) => ({
    html: `<tr><td class="c">${pad(index + 1)}</td><td class="item">${esc(line.item)}</td><td><span class="spec" style="margin:0">${esc(line.specification)}</span></td><td class="c">${esc(line.quantity)}</td><td class="c">${esc(line.unit)}</td><td class="r">${esc(plainAmount(line.unitPrice))}</td><td class="r">${esc(plainAmount(line.total))}</td></tr>`,
    mm: line.specification ? 11 : 7,
  }))
  const annex = doc.lines.length
    ? tableChunk(
        `<thead><tr><th class="c" style="width:7mm">S/L</th><th style="width:44mm">Item</th><th>Specification</th><th class="c" style="width:12mm">Qty</th><th class="c" style="width:9mm">Unit</th><th class="r" style="width:17mm">Unit Price (৳)</th><th class="r" style="width:21mm">Total Price (৳)</th></tr></thead>`,
        annexRows,
        `<tfoot><tr class="grand"><td colspan="6" class="lbl">Total</td><td class="r">${tkSpan(amount)}</td></tr></tfoot>`,
        12,
        box,
      )
    : []
  const first = flow(chunks, budget(box, annex.length ? 0 : signReserve))
  const second = flow(annex, budget(box, signReserve))
  const bodies = [...first, ...second]
  const project = doc.facts.find((fact) => fact.label === "Project Name")?.value ?? ""
  return {
    title: "Bill Invoice",
    subtitle: doc.title,
    ref: `Invoice No. ${doc.documentNo}`,
    refLines,
    pageRefs: [
      refLines,
      [
        ["Invoice No.", doc.documentNo],
        ["Project Name", project || "—"],
      ],
    ],
    pageSubtitles: [doc.title, second.length ? "Bill Of Quantities" : doc.title],
    verifyUrl: doc.verifyUrl,
    bodies: bodies.length ? bodies : [""],
    signs,
  }
}

function receipt(
  doc: PrintDocument,
  box: ContentBox,
  refLines: Array<[string, string]>,
  signs: string,
  signReserve: number,
): Built {
  const line = doc.lines[0]
  const amount = doc.summary[0]?.amount ?? ""
  const row = {
    html: `<tr><td class="c">01</td><td class="item">${esc(line?.item || "Payment received")}${line?.specification ? `<span class="spec">${esc(line.specification)}</span>` : ""}</td><td class="r">${tkSpan(amount)}</td></tr>`,
    mm: 12,
  }
  const chunks: Chunk[] = [
    chunk(cards(doc), 36),
    ...tableChunk(
      `<thead><tr><th class="c" style="width:10mm">S/L</th><th>Description</th><th class="r" style="width:36mm">Amount</th></tr></thead>`,
      [row],
      `<tfoot><tr class="grand"><td colspan="2" class="lbl">${esc(doc.summary[0]?.label || "Total Paid")}</td><td class="r">${tkSpan(amount)}</td></tr></tfoot>`,
      12,
      box,
    ),
    chunk(wordsBox(doc.wordsLabel, doc.words), 16),
  ]
  const notes = listBlock(doc.notes, "Notes", false)
  if (notes) chunks.push(notes)
  chunks.push(chunk(`<p class="thanks">Thanks &amp; Regards,</p>`, 6))
  return baseBuilt("Money Receipt", doc, refLines, flow(chunks, budget(box, signReserve)), signs)
}

function buildChallan(doc: ChallanModel, box: ContentBox): Built {
  const rows = doc.lines.map((line, index) => ({
    html: `<tr><td class="c">${pad(index + 1)}</td><td class="item">${esc(line.item)}${line.specification ? `<span class="spec">${esc(line.specification)}</span>` : ""}</td><td class="c">${esc(line.unit)}</td><td class="c">${esc(line.ordered)}</td><td class="c"><b>${esc(line.delivered)}</b></td><td>${esc(line.remarks)}</td></tr>`,
    mm: line.specification ? 12 : 8,
  }))
  const ordered = doc.lines.reduce((sum, line) => sum + (Number(line.ordered) || 0), 0)
  const delivered = doc.lines.reduce((sum, line) => sum + (Number(line.delivered) || 0), 0)
  const chunks: Chunk[] = [
    chunk(partyCards("Deliver To", doc.deliverToName, doc.deliverToDetail, "Dispatch Details", doc.facts), 40),
    ...tableChunk(
      `<thead><tr><th class="c" style="width:8mm">S/L</th><th>Item &amp; Description</th><th class="c" style="width:12mm">Unit</th><th class="c" style="width:17mm">Qty Ordered</th><th class="c" style="width:18mm">Qty Delivered</th><th style="width:33mm">Remarks</th></tr></thead>`,
      rows,
      `<tfoot><tr class="soft"><td colspan="3" class="lbl">Total Quantity</td><td class="c">${esc(trimNum(ordered))}</td><td class="c">${esc(trimNum(delivered))}</td><td>${doc.packages.trim() ? esc(doc.packages) : ""}</td></tr></tfoot>`,
      10,
      box,
    ),
    chunk(
      `<div class="words"><span>Receiver’s Declaration</span>${esc(doc.declaration || "Received the above goods in good order and condition, quantities checked and found correct except as noted in Remarks.")}</div>`,
      16,
    ),
  ]
  if (doc.note.trim()) chunks.push(chunk(`<p class="note" style="margin-top:3mm">${esc(doc.note)}</p>`, 8))
  return finish("Delivery Challan", "Goods Dispatch Note", `Challan No. ${doc.documentNo}`, doc, chunks, box)
}

function buildVoucher(doc: VoucherModel, box: ContentBox): Built {
  const rows = doc.lines.map((line, index) => ({
    html: `<tr><td class="c">${pad(index + 1)}</td><td class="item">${esc(line.item)}${line.specification ? `<span class="spec">${esc(line.specification)}</span>` : ""}</td><td class="r">${line.deduct ? `(${esc(fmt(Math.abs(line.amount)))})` : tk(line.amount)}</td></tr>`,
    mm: line.specification ? 14 : 8,
  }))
  const chunks: Chunk[] = [
    chunk(partyCards("Paid To", doc.paidToName, doc.paidToDetail, "Voucher Details", doc.facts), 40),
    ...tableChunk(
      `<thead><tr><th class="c" style="width:10mm">S/L</th><th>Particulars</th><th class="r" style="width:36mm">Amount</th></tr></thead>`,
      rows,
      `<tfoot><tr class="grand"><td colspan="2" class="lbl">Net Amount Paid</td><td class="r">${tk(doc.net)}</td></tr></tfoot>`,
      12,
      box,
    ),
    chunk(wordsBox("Net Paid In Words", amountInWords(doc.net)), 16),
  ]
  if (doc.paymentMode.trim()) {
    chunks.push(chunk(`<div class="block"><h4>Payment Mode</h4><p class="plain">${esc(doc.paymentMode)}</p></div>`, 14))
  }
  if (doc.statusNote.trim()) {
    chunks.push(chunk(`<div class="block"><h4>Work Order Status</h4><p class="plain">${esc(doc.statusNote)}</p></div>`, 14))
  }
  if (doc.narration.trim()) {
    chunks.push(chunk(`<div class="words"><span>Narration</span>${esc(doc.narration)}</div>`, 16))
  }
  if (doc.note.trim()) chunks.push(chunk(`<p class="note" style="margin-top:2mm">${esc(doc.note)}</p>`, 8))
  return finish("Payment Voucher", "Vendor Payment", `Voucher No. ${doc.documentNo}`, doc, chunks, box)
}

function buildCertificate(doc: CertificateModel, box: ContentBox): Built {
  const scope = doc.scope.filter((item) => item.trim())
  const rows = doc.inspections.filter((row) => row.item.trim()).map((row) => ({
    html: `<tr><td>${esc(row.item)}</td><td class="c">${esc(row.status || "—")}</td><td>${esc(row.remarks || "—")}</td></tr>`,
    mm: 8,
  }))
  const chunks: Chunk[] = [chunk(partyCards("Client", doc.clientName, doc.clientDetail, "Project Details", doc.facts), 40)]
  if (doc.intro.trim()) chunks.push(chunk(`<div class="letter"><p>${esc(doc.intro)}</p></div>`, estimateText(doc.intro)))
  if (scope.length) {
    chunks.push(
      chunk(
        `<div class="block"><h4>Scope Of Work Completed</h4><ul>${scope.map((item) => `<li>${esc(item)}</li>`).join("")}</ul></div>`,
        12 + scope.length * 6,
      ),
    )
  }
  if (rows.length) {
    chunks.push(
      ...tableChunk(
        `<thead><tr><th>Inspection Item</th><th class="c" style="width:28mm">Status</th><th style="width:60mm">Remarks</th></tr></thead>`,
        rows,
        "",
        0,
        box,
      ),
    )
  }
  if (doc.defect.trim()) chunks.push(chunk(`<div class="words"><span>Defect Liability</span>${esc(doc.defect)}</div>`, 16))
  return finish(
    "Completion Certificate",
    "Work Completion · Handover & Acceptance",
    `Certificate No. ${doc.documentNo}`,
    doc,
    chunks,
    box,
  )
}

function buildSalary(doc: SalaryModel, box: ContentBox): Built {
  const rows = Math.max(doc.earnings.length, doc.deductions.length)
  const body = Array.from({ length: rows }, (_, index) => {
    const earn = doc.earnings[index]
    const deduct = doc.deductions[index]
    return {
      html: `<tr><td>${esc(earn?.label ?? "")}</td><td class="r">${earn ? esc(fmt(earn.amount)) : ""}</td><td>${esc(deduct?.label ?? "")}</td><td class="r">${deduct ? esc(fmt(deduct.amount)) : ""}</td></tr>`,
      mm: 8,
    }
  })
  const gross = doc.earnings.reduce((sum, row) => sum + row.amount, 0)
  const deducted = doc.deductions.reduce((sum, row) => sum + row.amount, 0)
  const chunks: Chunk[] = [
    chunk(partyCards("Employee", doc.employeeName, doc.employeeDetail, "Pay Details", doc.facts), 40),
    ...tableChunk(
      `<thead><tr><th>Earnings</th><th class="r" style="width:30mm">Amount (৳)</th><th>Deductions</th><th class="r" style="width:30mm">Amount (৳)</th></tr></thead>`,
      body,
      `<tfoot><tr class="soft"><td class="lbl">Gross Earnings</td><td class="r">${tk(gross)}</td><td class="lbl">Total Deductions</td><td class="r">${tk(deducted)}</td></tr><tr class="grand"><td colspan="3" class="lbl">Net Pay</td><td class="r">${tk(doc.net)}</td></tr></tfoot>`,
      18,
      box,
    ),
    chunk(wordsBox("Net Pay In Words", amountInWords(doc.net)), 16),
  ]
  const notes = doc.notes.filter((note) => note.trim())
  if (notes.length) {
    chunks.push(
      chunk(
        `<div class="block"><h4>Notes</h4><ul>${notes.map((note) => `<li>${esc(note)}</li>`).join("")}</ul></div>`,
        12 + notes.length * 6,
      ),
    )
  }
  return finish("Salary Slip", doc.periodSubtitle || "Pay Slip", `Salary Slip No. ${doc.documentNo}`, doc, chunks, box)
}

function buildLetter(doc: LetterModel, box: ContentBox): Built {
  const title = doc.notice ? "Notice" : "Letter"
  const chunks: Chunk[] = []
  if (!doc.notice && doc.addressee.length) {
    chunks.push(chunk(`<div class="addr">${doc.addressee.map((line) => esc(line)).join("<br>")}</div>`, 8 + doc.addressee.length * 5))
  }
  if (doc.subject.trim()) chunks.push(chunk(`<div class="subject"><span>Subject</span>${esc(doc.subject)}</div>`, 14))
  for (const paragraph of doc.paragraphs) {
    if (paragraph.trim()) chunks.push(chunk(`<div class="letter"><p>${esc(paragraph)}</p></div>`, estimateText(paragraph)))
  }
  if (doc.rows.length) {
    chunks.push(
      ...tableChunk(
        `<thead><tr><th style="width:55mm">Item</th><th>Instruction</th></tr></thead>`,
        doc.rows.map((row) => ({
          html: `<tr><td class="item">${esc(row.label)}</td><td>${esc(row.value)}</td></tr>`,
          mm: 8,
        })),
        "",
        0,
        box,
      ),
    )
  }
  if (doc.duty.length) {
    chunks.push(
      ...tableChunk(
        `<thead><tr><th class="c" style="width:10mm">S/L</th><th>Project Name</th><th>Site Location</th><th>Duty In-Charge</th><th style="width:30mm">Mobile</th></tr></thead>`,
        doc.duty.map((row, index) => ({
          html: `<tr><td class="c">${pad(index + 1)}</td><td>${esc(row.project)}</td><td>${esc(row.site)}</td><td>${esc(row.person)}</td><td>${esc(row.phone)}</td></tr>`,
          mm: 8,
        })),
        "",
        0,
        box,
      ),
    )
  }
  if (doc.closing.trim()) chunks.push(chunk(`<div class="letter"><p>${esc(doc.closing)}</p></div>`, estimateText(doc.closing)))
  chunks.push(chunk(`<p class="thanks">Thanks &amp; Regards,</p>`, 6))
  const built = finish(title, doc.audience || (doc.notice ? "For All Office & Site Staff" : "Official Correspondence"), `Ref: ${doc.documentNo}`, doc, chunks, box)
  if (doc.cc.trim()) {
    built.bodies[built.bodies.length - 1] += `<p class="note" style="margin-top:3mm">${esc(doc.cc)}</p>`
  }
  return built
}

function finish(
  title: string,
  subtitle: string,
  ref: string,
  doc: { documentNo: string; issuedOn: string; verifyUrl: string | null; signatures: SignLine[] },
  chunks: Chunk[],
  box: ContentBox,
): Built {
  const signs = signBlock(doc.signatures)
  const refLines: Array<[string, string]> = [
    [ref.split(":")[0]?.trim() || "Ref", doc.documentNo],
    ["Date", doc.issuedOn],
  ]
  return {
    title,
    subtitle,
    ref,
    refLines,
    pageRefs: [],
    pageSubtitles: [],
    verifyUrl: doc.verifyUrl,
    bodies: flow(chunks, budget(box, signs ? SIGN_MM : 0)),
    signs,
  }
}

function baseBuilt(
  title: string,
  doc: PrintDocument,
  refLines: Array<[string, string]>,
  bodies: string[],
  signs: string,
): Built {
  return {
    title,
    subtitle: doc.title,
    ref: `${doc.numberLabel} ${doc.documentNo}`,
    refLines,
    pageRefs: [],
    pageSubtitles: [],
    verifyUrl: doc.verifyUrl,
    bodies: bodies.length ? bodies : [""],
    signs,
  }
}

function budget(box: ContentBox, signReserve: number): number {
  return Math.max(30, box.height - HEAD_MM - FOOT_MM - signReserve)
}

function flow(chunks: Chunk[], limit: number): string[] {
  const pages: Chunk[][] = [[]]
  let used = 0
  for (const piece of chunks) {
    const current = pages[pages.length - 1]
    if (current.length && used + piece.mm > limit) {
      pages.push([])
      used = 0
    }
    pages[pages.length - 1].push(piece)
    used += piece.mm
  }
  const filled = pages.filter((page) => page.length)
  if (!filled.length) return [""]
  return filled.map((page) => page.map((piece) => piece.html).join("\n"))
}

function tableChunk(
  head: string,
  rows: Array<{ html: string; mm: number }>,
  footer: string,
  footerMm: number,
  box: ContentBox,
): Chunk[] {
  if (!rows.length && !footer) return []
  const limit = Math.max(40, box.height - HEAD_MM - FOOT_MM - 8)
  const chunks: Chunk[] = []
  let batch: Array<{ html: string; mm: number }> = []
  let used = 12
  const flush = (withFooter: boolean) => {
    if (!batch.length && !withFooter) return
    const foot = withFooter ? footer : ""
    chunks.push({
      html: `<table class="grid compact">${head}<tbody>${batch.map((row) => row.html).join("")}</tbody>${foot}</table>`,
      mm: used + (withFooter ? footerMm : 0),
    })
    batch = []
    used = 12
  }
  rows.forEach((row, index) => {
    const last = index === rows.length - 1
    if (batch.length && used + row.mm + (last ? footerMm : 0) > limit) flush(false)
    batch.push(row)
    used += row.mm
  })
  flush(true)
  return chunks
}

function chunk(html: string, mm: number): Chunk {
  return { html, mm }
}

function pageHtml(input: {
  body: string
  signs: string
  ref: string
  page: number
  total: number
  title: string
  subtitle: string
  refLines: Array<[string, string]>
  verifyUrl: string | null
  box: ContentBox
  mode: DocumentMode
  documentTitle: string
}): string {
  const image =
    input.mode === "letterhead"
      ? `<img class="bg" src="/brand/letterhead-300dpi.png" alt="">`
      : ""
  return `<section class="page" style="--doc-top:${input.box.top}mm;--doc-height:${input.box.height}mm">
  ${image}
  <div class="content">
${head(input.title, input.subtitle, input.refLines, input.verifyUrl)}
${input.body}
<div class="spacer"></div>
${input.signs}
    <div class="pfoot"><span>${esc(input.ref)}</span><span>Page ${input.page} of ${input.total}</span></div>
  </div>
</section>`
}

function shell(
  pages: string,
  title: string,
  box: ContentBox,
  mode: DocumentMode,
  inlineCss?: string,
): string {
  const bodyClass = mode === "print" ? "pad" : mode === "sheet" ? "sheet" : ""
  const css = inlineCss
    ? `<style>${inlineCss}</style>`
    : `<link rel="stylesheet" href="/documents/setc.css">`
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title>
${css}
<style>:root{--doc-top:${box.top}mm;--doc-height:${box.height}mm}.page{margin:0}</style>
</head>
<body class="${bodyClass}">
${pages}
</body></html>`
}

function head(title: string, subtitle: string, refLines: Array<[string, string]>, verifyUrl: string | null): string {
  const refs = refLines
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `${esc(label)}: <b>${esc(value)}</b>`)
    .join("<br>")
  const qr = qrSvg(verifyUrl)
  const qrHtml = qr ? `<div class="qr">${qr}<div class="cap">Scan to verify</div></div>` : ""
  return `<div class="head"><div class="hl">${qrHtml}<div class="ref">${refs}</div></div>
<div class="title"><h1>${esc(title)}</h1>${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ""}</div></div>`
}

function cards(doc: PrintDocument): string {
  const party = doc.parties[0]
  const left = party ? card(party.heading, party.name, party.detail) : ""
  const right = doc.facts.length ? card("Details", "", "", doc.facts) : ""
  if (doc.kicker === "Purchase Order" && doc.parties[1]) {
    const other = doc.parties[1]
    return `<div class="cards">${left}${card(other.heading, other.name, other.detail)}</div>`
  }
  if (doc.kicker === "Quotation" || doc.kicker === "Work Order" || doc.kicker === "Bill Invoice" || doc.kicker === "Money Receipt") {
    const heading =
      doc.kicker === "Quotation"
        ? "Project"
        : doc.kicker === "Work Order"
          ? "Order Details"
          : doc.kicker === "Bill Invoice"
            ? "Invoice Details"
            : "Receipt Details"
    return `<div class="cards">${left}${card(heading, "", "", doc.facts)}</div>`
  }
  return `<div class="cards">${left}${right}</div>`
}

function partyCards(
  leftTitle: string,
  name: string,
  detail: string,
  rightTitle: string,
  facts: Array<{ label: string; value: string }>,
): string {
  return `<div class="cards">${card(leftTitle, name, detail)}${card(rightTitle, "", "", facts)}</div>`
}

function card(
  title: string,
  name: string,
  detail: string,
  facts?: Array<{ label: string; value: string }>,
): string {
  const body = facts
    ? `<table class="kv">${facts
        .map((fact) => `<tr><td>${esc(fact.label)}</td><td>${esc(fact.value || "—")}</td></tr>`)
        .join("")}</table>`
    : `${name ? `<div class="name">${esc(name)}</div>` : ""}<p>${detail
        .split(/\n/)
        .map((line) => esc(line))
        .join("<br>")}</p>`
  return `<div class="card"><h3>${esc(title)}</h3>${body}</div>`
}

function signBlock(lines: SignLine[]): string {
  const visible = lines.filter((line) => line.label.trim())
  if (!visible.length) return ""
  const count = Math.min(4, visible.length)
  return `<div class="signs s${count}">${visible
    .slice(0, 4)
    .map(
      (line) =>
        `<div class="sign"><div class="line"><div class="role">${esc(line.label)}</div><div class="who">${esc(line.name)}</div><div class="des">${line.detail
          .split(/\n/)
          .map((part) => esc(part))
          .join("<br>")}</div></div></div>`,
    )
    .join("")}</div>`
}

function invoiceWords(doc: PrintDocument): string {
  if (!doc.netWords) return wordsBox(doc.wordsLabel, doc.words)
  return `<div class="words"><span>${esc(doc.wordsLabel)}</span>Grand Total: <b>${esc(doc.words)}</b><br>Net Payable: <b>${esc(doc.netWords)}</b></div>`
}

function wordsBox(label: string, words: string): string {
  if (!words.trim()) return ""
  return `<div class="words"><span>${esc(label)}</span><b>${esc(words)}</b></div>`
}

function listBlock(text: string, title: string, ordered: boolean): Chunk | null {
  const items = text
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean)
  if (!items.length) return null
  const tag = ordered ? "ol" : "ul"
  return chunk(
    `<div class="block"><h4>${esc(title)}</h4><${tag}>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</${tag}></div>`,
    12 + items.length * 6,
  )
}

function textColumns(left: string, leftTitle: string, right: string, rightTitle: string): Chunk | null {
  const a = listBlock(left, leftTitle, true)
  const b = listBlock(right, rightTitle, false)
  if (!a && !b) return null
  if (a && b) return chunk(`<div class="two-col">${a.html}${b.html}</div>`, Math.max(a.mm, b.mm))
  return a ?? b
}

function milestoneTable(doc: PrintDocument, grand = false): string {
  const rows = doc.milestones
    .map(
      (row, index) =>
        `<tr><td class="c">${pad(index + 1)}</td><td>${esc(row.label)}</td><td class="c">${esc(row.percent)}</td><td class="r">${esc(plainAmount(row.amount))}</td></tr>`,
    )
    .join("")
  const total = doc.summary.find((row) => row.strong)?.amount
  const foot = grand
    ? `<tfoot><tr class="grand"><td colspan="2" class="lbl">Total</td><td class="c">100%</td><td class="r">${tkSpan(total ?? "")}</td></tr></tfoot>`
    : ""
  return `<table class="grid compact"><thead><tr><th class="c" style="width:8mm">S/L</th><th>Milestone</th><th class="c" style="width:20mm">Percentage</th><th class="r" style="width:34mm">Amount (৳)</th></tr></thead><tbody>${rows}</tbody>${foot}</table>`
}

function summaryFooter(doc: PrintDocument): string {
  const rows = doc.summary
    .map((row, index) => {
      const grand = row.strong && index === doc.summary.length - 1
      const soft = row.strong && !grand
      const cls = grand ? "grand" : soft ? "soft" : ""
      const cols = doc.kicker === "Bill Invoice" || doc.kicker === "Money Receipt" ? 2 : doc.kicker === "Quotation" ? 2 : 5
      const amount = row.deduct ? `(${esc(plainAmount(row.amount))})` : grand || soft ? tkSpan(row.amount) : tkSpan(row.amount)
      return `<tr class="${cls}"><td colspan="${doc.kicker === "Quotation" ? 2 : cols}" class="lbl">${esc(row.label)}</td><td class="r">${amount}</td></tr>`
    })
    .join("")
  return `<tfoot>${rows}</tfoot>`
}

function grandFooter(label: string, doc: PrintDocument): string {
  const row = doc.summary.find((item) => item.strong) ?? doc.summary[doc.summary.length - 1]
  return `<tfoot><tr class="grand"><td colspan="5" class="lbl">${esc(label)}</td><td class="r">${tkSpan(row?.amount ?? "")}</td></tr></tfoot>`
}

function boqFooter(doc: PrintDocument): string {
  const sub = doc.summary.find((row) => /sub total/i.test(row.label))
  return `<tfoot><tr class="grand"><td colspan="5" class="lbl">Sub Total</td><td class="r">${tkSpan(sub?.amount ?? "")}</td></tr></tfoot>`
}

function boqHead(): string {
  return `<thead><tr><th class="c" style="width:8mm">S/L</th><th>Item &amp; Specification</th><th class="c" style="width:15mm">Quantity</th><th class="c" style="width:11mm">Unit</th><th class="r" style="width:22mm">Unit Price (৳)</th><th class="r" style="width:26mm">Total Price (৳)</th></tr></thead>`
}

function itemHead(totalLabel: string): string {
  return `<thead><tr><th class="c" style="width:8mm">S/L</th><th>Item &amp; Specification</th><th class="c" style="width:15mm">Quantity</th><th class="c" style="width:11mm">Unit</th><th class="r" style="width:22mm">Unit Price (৳)</th><th class="r" style="width:27mm">${esc(totalLabel)}</th></tr></thead>`
}

function itemRows(lines: PrintLine[]): Array<{ html: string; mm: number }> {
  const rows: Array<{ html: string; mm: number }> = []
  let lastSection = ""
  lines.forEach((line, index) => {
    if (line.section && line.section !== lastSection) {
      lastSection = line.section
      rows.push({
        html: `<tr class="sec-row"><td colspan="6">${esc(line.section)}</td></tr>`,
        mm: 8,
      })
    }
    rows.push({
      html: `<tr><td class="c">${pad(index + 1)}</td><td class="item">${esc(line.item)}${line.specification ? `<span class="spec">${esc(line.specification)}</span>` : ""}</td><td class="c">${esc(line.quantity)}</td><td class="c">${esc(line.unit)}</td><td class="r">${esc(plainAmount(line.unitPrice))}</td><td class="r">${esc(plainAmount(line.total))}</td></tr>`,
      mm: line.specification ? 12 : 8,
    })
  })
  return rows
}

function boqRowsOf(lines: PrintLine[]): Array<{ html: string; mm: number }> {
  return itemRows(lines)
}

function groupLines(lines: PrintLine[]): Array<{ name: string; amount: number }> {
  const groups: Array<{ name: string; amount: number }> = []
  for (const line of lines) {
    const name = line.section.trim() || line.item
    const amount = parseAmount(line.total)
    const found = groups.find((group) => group.name === name)
    if (found) found.amount += amount
    else groups.push({ name, amount })
  }
  return groups
}

function splitIntro(intro: string): { subject: string; body: string } {
  const parts = intro.split(/\n\n/).map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) return { subject: parts[0] ?? "", body: parts.slice(1).join("\n\n") }
  return { subject: "", body: intro.trim() }
}

function estimateText(value: string): number {
  return 10 + Math.ceil(value.length / 90) * 6
}

function parseAmount(value: string): number {
  const parsed = Number(value.replace(/[^\d.-]/g, ""))
  return Number.isFinite(parsed) ? parsed : 0
}

function plainAmount(value: string): string {
  if (!value.trim()) return ""
  return value.replace(/৳/g, "").trim()
}

function fmt(value: number): string {
  return formatGroupedAmount(value, 2)
}

function tk(value: number): string {
  return `<span class="tk">৳</span>${esc(fmt(value))}`
}

function tkSpan(value: string): string {
  const plain = plainAmount(value)
  if (!plain) return ""
  return `<span class="tk">৳</span>${esc(plain)}`
}

function pad(value: number): string {
  return String(value).padStart(2, "0")
}

function trimNum(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function documentFileName(documentNo: string, letterhead: boolean): string {
  const stem = (documentNo.trim() || "document").replaceAll("/", "-").replace(/[^\w.-]+/g, "-")
  return letterhead ? `${stem}.pdf` : `${stem}-print.pdf`
}
