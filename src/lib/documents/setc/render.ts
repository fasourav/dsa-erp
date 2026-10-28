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
  RfqModel,
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
  draft = false,
): { pages: string[]; html: string } {
  const box = contentBox(margins)
  const built = build(model, box)
  const sections = built.bodies.map((body, index) =>
    pageHtml({
      body,
      signs: built.pageSigns?.[index] || (index === built.bodies.length - 1 ? built.signs : ""),
      ref: built.pageFooters?.[index] || built.ref,
      page: index + 1,
      total: built.bodies.length,
      title: built.pageTitles?.[index] || built.title,
      subtitle: built.pageSubtitles[index] ?? built.subtitle,
      refLines: built.pageRefs[index] ?? built.refLines,
      verifyUrl: built.showQr === false ? null : built.verifyUrl,
      box,
      mode,
      documentTitle: built.title,
    }),
  )
  // Each page is a full document so the preview iframe can load the stylesheet.
  // A bare section has no <link>, which is why the live preview rendered unstyled.
  const pages = sections.map((section) => shell(section, built.title, box, mode, inlineCss, draft))
  return { pages, html: shell(sections.join("\n"), built.title, box, mode, inlineCss, draft) }
}

function build(model: DocumentModel, box: ContentBox): Built {
  if (model.kind === "print") return buildPrint(model.doc, box)
  if (model.kind === "rfq") return buildRfq(model.doc, box)
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
  pageTitles?: string[]
  pageFooters?: string[]
  pageSigns?: string[]
  showQr?: boolean
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
  if (doc.kicker === "Work Order") return workOrder(doc, box, refLines)
  if (doc.kicker === "Purchase Order") return purchaseOrder(doc, box, refLines, signs, signReserve)
  if (doc.kicker === "Bill Invoice") return invoice(doc, box, refLines)
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
): Built {
  const intro = splitIntro(doc.intro)
  const rows = itemRows(doc.lines)
  const table = tableChunk(itemHead("Total Price (৳)"), rows, grandFooter(doc.summary[0]?.label ?? "Total Work Order Value", doc), 12, box)
  const page1: Chunk[] = [chunk(cards(doc), 34)]
  if (intro.subject) {
    page1.push(chunk(`<div class="subject"><span>Subject</span>${esc(intro.subject)}</div>`, 14))
  }
  if (intro.body) page1.push(chunk(`<div class="letter"><p class="intro">${escLines(intro.body)}</p></div>`, estimateText(intro.body)))
  page1.push(...table, chunk(wordsBox(doc.wordsLabel, doc.words), 16), chunk(`<p class="thanks">Thanks &amp; Regards,</p>`, 6))
  const terms = listBlock(doc.terms, "Terms & Conditions", true)
  const pay = doc.milestones.length
    ? chunk(
        `<div class="block tight"><h4>Payment Terms</h4>${milestoneTable(doc, true)}<p class="note" style="margin-top:1mm">Applicable VAT and AIT will be deducted at source from each bill as per Government rules.</p></div>`,
        22 + doc.milestones.length * 7,
      )
    : null
  const page2: Chunk[] = []
  if (pay) page2.push(pay)
  if (terms) page2.push(terms)
  if (page2.length) page2.push(chunk(`<p class="thanks">Thank you for your cooperation.</p>`, 6))
  const pageSigns = signBlock(
    doc.signatures,
  )
  const first = stamp(flow(page1, budget(box, pageSigns ? SIGN_MM : 0)), pageSigns)
  const second = page2.length ? stamp(flow(page2, budget(box, pageSigns ? SIGN_MM : 0)), pageSigns) : { bodies: [], signs: [] }
  const bodies = [...first.bodies, ...second.bodies]
  const foot = `WO No. ${doc.documentNo}`
  return {
    ...baseBuilt("Work Order", doc, refLines, bodies, ""),
    ref: foot,
    pageSigns: [...first.signs, ...second.signs],
    pageFooters: bodies.map(() => foot),
    pageSubtitles: bodies.map((_, index) => (index < first.bodies.length ? doc.title : "Terms & Conditions")),
  }
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
  const carried = doc.summary.find((row) => /grand total|total quoted|net payable/i.test(row.label) && row.strong)
  const annex = doc.lines.length
    ? tableChunk(
        `<thead><tr><th class="c" style="width:7mm">S/L</th><th style="width:44mm">Item</th><th>Specification</th><th class="c" style="width:12mm">Qty</th><th class="c" style="width:9mm">Unit</th><th class="r" style="width:17mm">Unit Price (৳)</th><th class="r" style="width:21mm">Total Price (৳)</th></tr></thead>`,
        annexRows,
        `<tfoot><tr><td colspan="6" class="lbl">Sub Total</td><td class="r">${tkSpan(amount)}</td></tr><tr class="grand"><td colspan="6" class="lbl">Rounded Total (carried to Invoice)</td><td class="r">${tkSpan(carried?.amount || amount)}</td></tr></tfoot>`,
        16,
        box,
      )
    : []
  const page1Signs = signBlock(
    doc.signatures.filter((line) => /prepared by|authorized|received by/i.test(line.label)),
  )
  const page2Signs = signBlock(
    doc.signatures.flatMap((line) => {
      if (/^prepared by$/i.test(line.label)) return [{ ...line, label: "Measured & Prepared By" }]
      if (/authorized/i.test(line.label)) return [line]
      return []
    }),
  )
  const first = stamp(flow(chunks, budget(box, page1Signs ? SIGN_MM : 0)), page1Signs)
  const second = annex.length ? stamp(flow(annex, budget(box, page2Signs ? SIGN_MM : 0)), page2Signs) : { bodies: [], signs: [] }
  const bodies = [...first.bodies, ...second.bodies]
  const project = doc.facts.find((fact) => fact.label === "Project Name")?.value ?? ""
  const foot = `Invoice No. ${doc.documentNo}`
  return {
    title: "Bill Invoice",
    subtitle: doc.title,
    ref: foot,
    refLines,
    pageRefs: bodies.map((_, index) =>
      index < first.bodies.length
        ? refLines
        : [
            ["Invoice No.", doc.documentNo],
            ["Project Name", project || "—"],
          ],
    ),
    pageSubtitles: bodies.map((_, index) => (index < first.bodies.length ? doc.title : "Bill Of Quantities")),
    pageTitles: bodies.map((_, index) => (index < first.bodies.length ? "Bill Invoice" : "Annexure-A")),
    pageFooters: bodies.map((_, index) => (index < first.bodies.length ? foot : `${foot} · Annexure-A`)),
    pageSigns: [...first.signs, ...second.signs],
    verifyUrl: doc.verifyUrl,
    bodies: bodies.length ? bodies : [""],
    signs: "",
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

function buildRfq(doc: RfqModel, box: ContentBox): Built {
  const headHtml = `<thead><tr><th class="c" style="width:8mm">S/L</th><th>Item &amp; Specification</th><th class="c" style="width:18mm">Quantity</th><th class="c" style="width:14mm">Unit</th><th style="width:36mm">Remarks</th></tr></thead>`
  const rows = doc.lines.map((line, index) => {
    const itemLines = Math.max(1, Math.ceil(line.item.trim().length / 48))
    const specLines = line.specification.trim() ? Math.max(1, Math.ceil(line.specification.trim().length / 72)) : 0
    return {
      html: `<tr><td class="c">${pad(index + 1)}</td><td class="item">${esc(line.item)}${line.specification ? `<span class="spec">${esc(line.specification)}</span>` : ""}</td><td class="c">${esc(line.quantity)}</td><td class="c">${esc(line.unit)}</td><td>${esc(line.remarks)}</td></tr>`,
      mm: 2.3 + itemLines * 4.2 + specLines * 3.4,
    }
  })
  const detailLines = doc.toDetail.split("\n").filter((line) => line.trim()).length
  const leadParts: string[] = [partyCards("To", doc.toName || "—", doc.toDetail, "RFQ Details", doc.facts)]
  let leadMm = 33.2 + Math.max(0, detailLines - 3) * 4
  if (doc.subject.trim()) {
    leadParts.push(`<div class="subject tight"><span>Subject</span>${esc(doc.subject)}</div>`)
    leadMm += 5.3 + Math.ceil(doc.subject.trim().length / 82) * 4.8
  }
  if (doc.intro.trim()) {
    leadParts.push(`<p class="intro">${escLines(doc.intro)}</p>`)
    leadMm += 2.2 + wrappedLines(doc.intro, 128) * 4.5
  }

  const noteHtml = doc.note.trim() ? `<p class="note" style="margin-top:2.5mm">${escLines(doc.note)}</p>` : ""
  const noteMm = doc.note.trim() ? 2.5 + wrappedLines(doc.note, 138) * 4 : 0
  const tailHtml = `${noteHtml}<p class="thanks" style="margin-top:2.5mm">Thanks &amp; Regards,</p>`
  const tailMm = noteMm + 7.1

  const signHtml = rfqSignBlock(doc.signatures, doc.vendorSignature)
  const noSignLimit = Math.max(40, box.height - 38)
  const withSignLimit = Math.max(35, noSignLimit - (signHtml ? 42 : 0))
  const wrapTable = (batch: typeof rows) =>
    batch.length
      ? `<table class="grid compact">${headHtml}<tbody>${batch.map((row) => row.html).join("")}</tbody></table>`
      : ""

  const firstBodies = rfqBodyPages(
    leadParts.join("\n"),
    leadMm,
    rows,
    wrapTable,
    tailHtml,
    tailMm,
    noSignLimit,
    withSignLimit,
  )

  const terms = listBlock(doc.terms, "Terms & Conditions", true)
  const page2: Chunk[] = []
  if (terms) {
    page2.push(terms)
    page2.push(chunk(`<p class="thanks">Thank you for your cooperation.</p>`, 6))
  }

  const first = stamp(firstBodies, signHtml)
  const second = page2.length ? stamp(flow(page2, withSignLimit), signHtml) : { bodies: [], signs: [] }
  const bodies = [...first.bodies, ...second.bodies]
  const subtitle = doc.subtitle || "Vendor / Service Provider"
  const foot = `RFQ No. ${doc.documentNo}`
  const refLines: Array<[string, string]> = [
    ["Ref", doc.documentNo],
    ["Date", doc.issuedOn],
  ]
  return {
    title: "Request For Quotation",
    subtitle,
    ref: foot,
    refLines,
    pageRefs: [],
    pageSubtitles: bodies.map((_, index) => (index < first.bodies.length ? subtitle : "Terms & Conditions")),
    pageFooters: bodies.map(() => foot),
    pageSigns: [...first.signs, ...second.signs],
    verifyUrl: doc.verifyUrl,
    bodies: bodies.length ? bodies : [""],
    signs: "",
  }
}

function rfqBodyPages(
  leadHtml: string,
  leadMm: number,
  rows: Array<{ html: string; mm: number }>,
  wrapTable: (batch: Array<{ html: string; mm: number }>) => string,
  tailHtml: string,
  tailMm: number,
  noSignLimit: number,
  withSignLimit: number,
): string[] {
  const theadMm = 5.5
  const rowsMm = rows.length ? theadMm + rows.reduce((sum, row) => sum + row.mm, 0) : 0
  if (leadMm + rowsMm + tailMm <= withSignLimit) {
    return [[leadHtml, wrapTable(rows), tailHtml].filter(Boolean).join("\n")]
  }
  if (!rows.length) {
    return [leadHtml, tailHtml].filter(Boolean)
  }

  const batches: Array<Array<{ html: string; mm: number }>> = [[]]
  let used = leadMm + theadMm
  for (const row of rows) {
    const current = batches[batches.length - 1]!
    if (current.length && used + row.mm > noSignLimit) {
      batches.push([])
      used = theadMm
    }
    batches[batches.length - 1]!.push(row)
    used += row.mm
  }

  if (used + tailMm > withSignLimit) {
    const last = batches[batches.length - 1]!
    if (last.length > 1) {
      const moved = last.pop()!
      batches.push([moved])
    } else if (batches.length === 1 && last.length === 1) {
      return [leadHtml, `${wrapTable(last)}\n${tailHtml}`]
    }
  }

  return batches.map((batch, index) => {
    const prefix = index === 0 ? `${leadHtml}\n` : ""
    const suffix = index === batches.length - 1 ? `\n${tailHtml}` : ""
    return `${prefix}${wrapTable(batch)}${suffix}`
  })
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
  const driver = doc.facts.find((fact) => fact.label === "Driver Name")?.value ?? ""
  const dispatched = doc.signatures.find((line) => /dispatched|prepared/i.test(line.label))
  const received = doc.signatures.find((line) => /received/i.test(line.label))
  const signHtml = signBlock([
    ...(dispatched ? [{ ...dispatched, label: "Dispatched By" }] : []),
    { label: "Delivered By", name: driver, detail: "Driver" },
    {
      label: "Received By",
      name: received?.name ?? "",
      detail: received?.detail || "Name, Signature & Date",
    },
  ])
  return finish("Delivery Challan", "Goods Dispatch Note", "Challan No.", doc, chunks, box, { signHtml })
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
  return finish("Payment Voucher", "Vendor Payment", "Voucher No.", doc, chunks, box)
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
    const tables = tableChunk(
      `<thead><tr><th>Inspection Item</th><th class="c" style="width:28mm">Status</th><th style="width:60mm">Remarks</th></tr></thead>`,
      rows,
      "",
      0,
      box,
    )
    if (tables[0]) tables[0] = { html: `<div class="inspect">${tables[0].html}</div>`, mm: tables[0].mm + 8 }
    chunks.push(...tables)
  }
  if (doc.defect.trim()) chunks.push(chunk(`<div class="words"><span>Defect Liability</span>${esc(doc.defect)}</div>`, 16))
  return finish(
    "Completion Certificate",
    "Work Completion · Handover & Acceptance",
    "Certificate No.",
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
  return finish("Salary Slip", doc.periodSubtitle || "Pay Slip", "Slip No.", doc, chunks, box)
}

function buildLetter(doc: LetterModel, box: ContentBox): Built {
  const title = doc.notice ? "Notice" : "Letter"
  const chunks: Chunk[] = []
  if (!doc.notice && doc.addressee.length) {
    chunks.push(
      chunk(
        `<div class="addr">${doc.addressee
          .map((line, index) => {
            const strong = doc.addresseeStrong?.[index] ?? index === 0
            const html = rich(line)
            return strong ? `<b>${html}</b>` : html
          })
          .join("<br>")}</div>`,
        8 + doc.addressee.length * 5,
      ),
    )
  }
  if (doc.subject.trim()) chunks.push(chunk(`<div class="subject"><span>Subject</span>${rich(doc.subject)}</div>`, 14))
  const paragraphs = doc.paragraphs.filter((paragraph) => paragraph.trim())
  const lead = doc.notice ? paragraphs.slice(0, 1) : paragraphs
  const rest = doc.notice ? paragraphs.slice(1) : []
  for (const paragraph of lead) {
    chunks.push(chunk(`<div class="letter"><p>${richLines(paragraph)}</p></div>`, estimateText(paragraph)))
  }
  if (doc.rows.length) {
    chunks.push(
      ...tableChunk(
        `<thead><tr><th style="width:55mm">Item</th><th>Instruction</th></tr></thead>`,
        doc.rows.map((row) => ({
          html: `<tr><td class="item">${esc(row.label)}</td><td>${rich(row.value)}</td></tr>`,
          mm: 8,
        })),
        "",
        0,
        box,
      ),
    )
  }
  if (doc.duty.length) {
    const duty = tableChunk(
      `<thead><tr><th class="c" style="width:10mm">S/L</th><th>Project Name</th><th>Site Location</th><th>Duty In-Charge</th><th style="width:30mm">Mobile</th></tr></thead>`,
      doc.duty.map((row, index) => ({
        html: `<tr><td class="c">${pad(index + 1)}</td><td>${esc(row.project)}</td><td>${esc(row.site)}</td><td>${esc(row.person)}</td><td>${esc(row.phone)}</td></tr>`,
        mm: 8,
      })),
      "",
      0,
      box,
    )
    chunks.push(
      chunk(
        `<div class="block spaced"><h4>Site Security Duty During Holiday</h4>${duty.map((piece) => piece.html).join("")}</div>`,
        12 + doc.duty.length * 8,
      ),
    )
  }
  for (const paragraph of rest) {
    chunks.push(chunk(`<div class="letter"><p>${richLines(paragraph)}</p></div>`, estimateText(paragraph)))
  }
  if (doc.closing.trim()) chunks.push(chunk(`<div class="letter"><p>${rich(doc.closing)}</p></div>`, estimateText(doc.closing)))
  const signed = doc.notice
    ? (doc.signatures.length ? doc.signatures : [{ label: "Issued By", name: "", detail: "" }]).map((line, index) =>
        index === 0 ? { ...line, label: "Issued By" } : line,
      )
    : doc.signatures
  const signHtml = `${doc.notice ? "" : `<p class="thanks">Thanks &amp; Regards,</p>`}${signBlock(signed.length ? signed : [{ label: "Authorized Signature", name: "", detail: "" }], "half")}${
    doc.cc.trim() ? `<p class="note" style="margin-top:3mm">${esc(doc.cc)}</p>` : ""
  }`
  const built = finish(
    title,
    doc.audience || (doc.notice ? "For All Office & Site Staff" : "Official Correspondence"),
    "Ref",
    doc,
    chunks,
    box,
    { showQr: false, signHtml },
  )
  return built
}

function finish(
  title: string,
  subtitle: string,
  label: string,
  doc: { documentNo: string; issuedOn: string; verifyUrl: string | null; signatures: SignLine[] },
  chunks: Chunk[],
  box: ContentBox,
  options?: { showQr?: boolean; signHtml?: string },
): Built {
  const signs = options?.signHtml ?? signBlock(doc.signatures)
  const refLines: Array<[string, string]> = [
    [label, doc.documentNo],
    ["Date", doc.issuedOn],
  ]
  return {
    title,
    subtitle,
    ref: `${label} ${doc.documentNo}`,
    refLines,
    pageRefs: [],
    pageSubtitles: [],
    showQr: options?.showQr,
    verifyUrl: doc.verifyUrl,
    bodies: flow(chunks, budget(box, signs ? SIGN_MM : 0)),
    signs,
  }
}

function stamp(bodies: string[], signs: string): { bodies: string[]; signs: string[] } {
  if (!bodies.length) return { bodies: [""], signs: [signs] }
  return { bodies, signs: bodies.map((_, index) => (index === bodies.length - 1 ? signs : "")) }
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
  draft = false,
): string {
  const bodyClass = [mode === "print" ? "pad" : mode === "sheet" ? "sheet" : "", draft ? "draft" : ""]
    .filter(Boolean)
    .join(" ")
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
  const compact = title.trim().length > 18 ? " compact" : ""
  return `<div class="head"><div class="hl">${qrHtml}<div class="ref">${refs}</div></div>
<div class="title${compact}"><h1>${esc(title)}</h1>${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ""}</div></div>`
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

function signCell(line: SignLine): string {
  return `<div class="sign"><div class="line"><div class="role">${esc(line.label)}</div><div class="who">${esc(line.name)}</div><div class="des">${line.detail
    .split(/\n/)
    .map((part) => esc(part))
    .join("<br>")}</div></div></div>`
}

function signBlock(lines: SignLine[], layout: "auto" | "half" = "auto"): string {
  const visible = lines.filter((line) => line.label.trim())
  if (!visible.length) return ""
  const count = layout === "half" ? 2 : Math.min(4, visible.length)
  const cells = visible
    .slice(0, 4)
  const filler = layout === "half" && visible.length < 2 ? "<div></div>" : ""
  return `<div class="signs s${count}">${cells.map(signCell).join("")}${filler}</div>`
}

function rfqSignBlock(staff: SignLine[], vendor?: SignLine | null): string {
  const left = staff.filter((line) => line.label.trim()).slice(0, 3)
  const right = vendor && vendor.label.trim() ? vendor : null
  if (!right) return signBlock(left)
  const spacers = "<div></div>".repeat(Math.max(0, 3 - left.length))
  return `<div class="signs s4">${left.map(signCell).join("")}${spacers}${signCell(right)}</div>`
}

function rich(value: string): string {
  return esc(value).replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
}

/** Like `rich`, but keeps single line breaks typed inside a paragraph. */
function richLines(value: string): string {
  return value
    .trim()
    .split(/\r?\n/)
    .map((line) => rich(line))
    .join("<br>")
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

function escLines(value: string): string {
  return value
    .trim()
    .split(/\r?\n/)
    .map((line) => esc(line))
    .join("<br>")
}

function wrappedLines(value: string, perLine: number): number {
  return value
    .trim()
    .split(/\r?\n/)
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0)
}

export function documentFileName(documentNo: string, letterhead: boolean): string {
  const stem = (documentNo.trim() || "document").replaceAll("/", "-").replace(/[^\w.-]+/g, "-")
  return letterhead ? `${stem}.pdf` : `${stem}-print.pdf`
}
