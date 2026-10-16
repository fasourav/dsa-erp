import { formatIsoDate, formatMoney } from "@/lib/format"
import {
  defaultSubtitles,
  documentCompanyName,
  printedSubtitle,
  type LineInput,
  type MilestoneInput,
} from "@/lib/documents/drafts"
import { amountInWords, lineAmount, moneyRound, sumAmounts } from "@/lib/documents/money"

export type SummaryRow = {
  label: string
  amount: string
  strong?: boolean
  deduct?: boolean
}

export type PrintLine = {
  section: string
  item: string
  specification: string
  quantity: string
  unit: string
  unitPrice: string
  total: string
}

export type PrintDocument = {
  kicker: string
  title: string
  numberLabel: string
  documentNo: string
  issuedOn: string
  verifyUrl: string | null
  parties: Array<{ heading: string; name: string; detail: string }>
  facts: Array<{ label: string; value: string }>
  intro: string
  lines: PrintLine[]
  milestonesTitle: string
  milestones: Array<{ label: string; percent: string; amount: string }>
  wordsLabel: string
  words: string
  summary: SummaryRow[]
  terms: string
  exclusions: string
  notes: string
  signatures: Array<{ label: string; name: string; detail: string }>
}

export type PricedLines = {
  lines: PrintLine[]
  subtotal: number
}

export function priceLines(lines: LineInput[]): PricedLines {
  const priced = lines.flatMap((line) => {
    const item = line.item.trim()
    if (!item) return []
    const total = lineAmount(line.quantity, line.unitPrice)
    return [
      {
        section: line.section.trim(),
        item,
        specification: line.specification.trim(),
        quantity: line.quantity.trim(),
        unit: line.unit.trim(),
        unitPrice: line.unitPrice.trim() ? formatMoney(Number(line.unitPrice) || 0) : "",
        total: formatMoney(total),
      },
    ]
  })
  return {
    lines: priced,
    subtotal: sumAmounts(
      lines
        .filter((line) => line.item.trim())
        .map((line) => lineAmount(line.quantity, line.unitPrice)),
    ),
  }
}

export function priceMilestones(
  milestones: MilestoneInput[],
  base: number,
): PrintDocument["milestones"] {
  return milestones.flatMap((milestone) => {
    const label = milestone.label.trim()
    if (!label) return []
    const percent = Number(milestone.percent)
    const safe = Number.isFinite(percent) ? percent : 0
    return [
      {
        label,
        percent: `${trimNumber(safe)}%`,
        amount: formatMoney(moneyRound((base * safe) / 100)),
      },
    ]
  })
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")
}

function aitAmount(subtotal: number, percent: string): number {
  const rate = Number(percent)
  if (!Number.isFinite(rate) || rate <= 0) return 0
  return moneyRound((subtotal * rate) / 100)
}

export function presentQuotation(input: {
  documentNo: string
  issuedOn: string
  validUntil: string
  verifyUrl: string | null
  preparedForName: string
  preparedForDetail: string
  clientName: string
  projectName: string
  area: string
  subject: string
  aitPercent: string
  lines: LineInput[]
  milestones: MilestoneInput[]
  terms: string
  exclusions: string
  subtitle: string
  preparedBy: string
  preparedByRole: string
  checkedBy: string
  checkedByRole: string
  authorizedBy: string
  authorizedByRole: string
}): PrintDocument {
  const priced = priceLines(input.lines)
  const ait = aitAmount(priced.subtotal, input.aitPercent)
  const total = moneyRound(priced.subtotal + ait)
  const rate = Number(input.aitPercent)
  const summary: SummaryRow[] = [{ label: "Sub Total", amount: formatMoney(priced.subtotal) }]
  if (ait > 0) {
    summary.push({
      label: `AIT (${trimNumber(rate)}%)`,
      amount: formatMoney(ait),
    })
  }
  summary.push({
    label: "Total Quoted Amount",
    amount: formatMoney(total),
    strong: true,
  })

  return {
    kicker: "Quotation",
    title: printedSubtitle(input.subtitle, defaultSubtitles.quotation),
    numberLabel: "Quotation No.",
    documentNo: input.documentNo || "Assigned when saved",
    issuedOn: formatIsoDate(input.issuedOn),
    verifyUrl: input.verifyUrl,
    parties: [
      {
        heading: "Prepared For",
        name: input.preparedForName || "—",
        detail: input.preparedForDetail,
      },
    ],
    facts: [
      { label: "Client Name", value: input.clientName || "—" },
      { label: "Project Name", value: input.projectName || "—" },
      { label: "Area", value: input.area || "—" },
      { label: "Valid Until", value: input.validUntil ? formatIsoDate(input.validUntil) : "—" },
    ],
    intro: input.subject.trim(),
    lines: priced.lines,
    milestonesTitle: "Payment Schedule",
    milestones: priceMilestones(input.milestones, total),
    wordsLabel: "Amount In Words",
    words: amountInWords(total),
    summary,
    terms: input.terms.trim(),
    exclusions: input.exclusions.trim(),
    notes: "",
    signatures: [
      {
        label: "Prepared By",
        name: input.preparedBy,
        detail: input.preparedByRole,
      },
      {
        label: "Checked By",
        name: input.checkedBy,
        detail: input.checkedByRole,
      },
      {
        label: "Authorized Signature",
        name: input.authorizedBy,
        detail: [input.authorizedByRole, documentCompanyName].filter(Boolean).join("\n"),
      },
      {
        label: "Accepted By (Client)",
        name: input.clientName,
        detail: "Signature & Date",
      },
    ],
  }
}

export function presentWorkOrder(input: {
  documentNo: string
  issuedOn: string
  verifyUrl: string | null
  vendorName: string
  vendorDetail: string
  projectName: string
  proposalOn: string
  workStart: string
  workEnd: string
  subject: string
  introduction: string
  lines: LineInput[]
  milestones: MilestoneInput[]
  terms: string
  subtitle: string
  preparedBy: string
  preparedByRole: string
  checkedBy: string
  checkedByRole: string
  authorizedBy: string
  authorizedByRole: string
}): PrintDocument {
  const priced = priceLines(input.lines)
  const period = [input.workStart, input.workEnd].filter(Boolean)
  const periodLabel =
    period.length === 2
      ? `${formatIsoDate(input.workStart)} – ${formatIsoDate(input.workEnd)}`
      : period.length === 1
        ? formatIsoDate(period[0] ?? "")
        : "—"

  return {
    kicker: "Work Order",
    title: printedSubtitle(input.subtitle, defaultSubtitles.workOrder),
    numberLabel: "Ref",
    documentNo: input.documentNo || "Assigned when saved",
    issuedOn: formatIsoDate(input.issuedOn),
    verifyUrl: input.verifyUrl,
    parties: [
      {
        heading: "To",
        name: input.vendorName || "—",
        detail: input.vendorDetail,
      },
    ],
    facts: [
      { label: "Vendor Name", value: input.vendorName || "—" },
      { label: "Project Name", value: input.projectName || "—" },
      {
        label: "Proposal Date",
        value: input.proposalOn ? formatIsoDate(input.proposalOn) : "—",
      },
      { label: "Work Period", value: periodLabel },
    ],
    intro: [input.subject.trim(), input.introduction.trim()].filter(Boolean).join("\n\n"),
    lines: priced.lines,
    milestonesTitle: "Payment Terms",
    milestones: priceMilestones(input.milestones, priced.subtotal),
    wordsLabel: "Amount In Words",
    words: amountInWords(priced.subtotal),
    summary: [
      {
        label: "Total Work Order Value",
        amount: formatMoney(priced.subtotal),
        strong: true,
      },
    ],
    terms: input.terms.trim(),
    exclusions: "",
    notes: "",
    signatures: [
      {
        label: "Prepared By",
        name: input.preparedBy,
        detail: input.preparedByRole,
      },
      {
        label: "Checked By",
        name: input.checkedBy,
        detail: input.checkedByRole,
      },
      {
        label: "Authorized Signature",
        name: input.authorizedBy,
        detail: [input.authorizedByRole, documentCompanyName].filter(Boolean).join("\n"),
      },
      {
        label: "Accepted By (Vendor)",
        name: input.vendorName,
        detail: "Signature, Seal & Date",
      },
    ],
  }
}

export function presentInvoice(input: {
  documentNo: string
  issuedOn: string
  dueOn: string
  verifyUrl: string | null
  billToName: string
  billToDetail: string
  customerName: string
  projectName: string
  workOrderNo: string
  aitPercent: string
  lines: LineInput[]
  deductions: Array<{ label: string; paidOn: string; amount: number }>
  terms: string
  paymentNote: string
  subtitle: string
  preparedBy: string
  preparedByRole: string
  checkedBy: string
  checkedByRole: string
  authorizedBy: string
  authorizedByRole: string
}): PrintDocument {
  const priced = priceLines(input.lines)
  const ait = aitAmount(priced.subtotal, input.aitPercent)
  const grand = moneyRound(priced.subtotal + ait)
  const rate = Number(input.aitPercent)
  const summary: SummaryRow[] = [{ label: "Sub Total", amount: formatMoney(priced.subtotal) }]
  if (ait > 0) {
    summary.push({ label: `AIT (${trimNumber(rate)}%)`, amount: formatMoney(ait) })
  }
  summary.push({ label: "Grand Total", amount: formatMoney(grand), strong: true })
  for (const deduction of input.deductions) {
    const when = deduction.paidOn ? ` (${formatIsoDate(deduction.paidOn)})` : ""
    summary.push({
      label: `Less: ${deduction.label}${when}`,
      amount: formatMoney(deduction.amount),
      deduct: true,
    })
  }
  const paid = sumAmounts(input.deductions.map((row) => row.amount))
  summary.push({
    label: "Net Payable",
    amount: formatMoney(moneyRound(Math.max(0, grand - paid))),
    strong: true,
  })

  return {
    kicker: "Bill Invoice",
    title: printedSubtitle(input.subtitle, defaultSubtitles.invoice),
    numberLabel: "Invoice No.",
    documentNo: input.documentNo || "Assigned when saved",
    issuedOn: formatIsoDate(input.issuedOn),
    verifyUrl: input.verifyUrl,
    parties: [
      {
        heading: "Bill To",
        name: input.billToName || "—",
        detail: input.billToDetail,
      },
    ],
    facts: [
      { label: "Due Date", value: input.dueOn ? formatIsoDate(input.dueOn) : "—" },
      { label: "Customer Name", value: input.customerName || "—" },
      { label: "Project Name", value: input.projectName || "—" },
      { label: "Work Order No.", value: input.workOrderNo || "—" },
    ],
    intro: "",
    lines: priced.lines,
    milestonesTitle: "",
    milestones: [],
    wordsLabel: "Amount In Words",
    words: amountInWords(grand),
    summary,
    terms: input.terms.trim(),
    exclusions: "",
    notes: input.paymentNote.trim(),
    signatures: [
      { label: "Prepared By", name: input.preparedBy, detail: input.preparedByRole },
      { label: "Checked By", name: input.checkedBy, detail: input.checkedByRole },
      {
        label: "Authorized Signature",
        name: input.authorizedBy,
        detail: [input.authorizedByRole, documentCompanyName].filter(Boolean).join("\n"),
      },
      {
        label: "Received By",
        name: "",
        detail: "Name, Signature & Date",
      },
    ],
  }
}

export function presentReceipt(input: {
  documentNo: string
  issuedOn: string
  verifyUrl: string | null
  receivedFromName: string
  receivedFromDetail: string
  customerName: string
  againstInvoiceNo: string
  method: string
  reference: string
  description: string
  amount: number
  bankName: string
  transferMode: string
  creditedTo: string
  notes: string
  subtitle: string
  preparedBy: string
  preparedByRole: string
  checkedBy: string
  checkedByRole: string
}): PrintDocument {
  return {
    kicker: "Money Receipt",
    title: printedSubtitle(input.subtitle, defaultSubtitles.receipt),
    numberLabel: "Receipt No.",
    documentNo: input.documentNo || "Assigned when saved",
    issuedOn: formatIsoDate(input.issuedOn),
    verifyUrl: input.verifyUrl,
    parties: [
      {
        heading: "Received From",
        name: input.receivedFromName || "—",
        detail: input.receivedFromDetail,
      },
    ],
    facts: [
      { label: "Against Invoice No.", value: input.againstInvoiceNo || "—" },
      { label: "Customer Name", value: input.customerName || "—" },
      { label: "Payment Method", value: input.method || "—" },
      { label: "Transaction Ref.", value: input.reference || "—" },
    ],
    intro: "",
    lines: input.description.trim()
      ? [
          {
            section: "",
            item: input.description.trim(),
            specification: "",
            quantity: "",
            unit: "",
            unitPrice: "",
            total: formatMoney(input.amount),
          },
        ]
      : [],
    milestonesTitle: "",
    milestones: [],
    wordsLabel: "Paid Amount In Words",
    words: amountInWords(input.amount),
    summary: [{ label: "Total Paid", amount: formatMoney(input.amount), strong: true }],
    terms: "",
    exclusions: "",
    notes: [
      input.bankName ? `Bank Name: ${input.bankName}` : "",
      input.transferMode ? `Transfer Mode: ${input.transferMode}` : "",
      input.issuedOn ? `Value Date: ${formatIsoDate(input.issuedOn)}` : "",
      input.creditedTo ? `Credited To: ${input.creditedTo}` : "",
      input.notes.trim(),
    ]
      .filter(Boolean)
      .join("\n"),
    signatures: [
      { label: "Prepared By", name: input.preparedBy, detail: input.preparedByRole },
      { label: "Checked By", name: input.checkedBy, detail: input.checkedByRole },
      {
        label: "Authorized Signature",
        name: "",
        detail: documentCompanyName,
      },
    ],
  }
}

export function presentPurchaseOrder(input: {
  documentNo: string
  issuedOn: string
  verifyUrl: string | null
  vendorName: string
  vendorDetail: string
  projectName: string
  site: string
  receiver: string
  deliveryOn: string
  lines: LineInput[]
  carrying: string
  terms: string
  subtitle: string
  preparedBy: string
  preparedByRole: string
  checkedBy: string
  checkedByRole: string
  authorizedBy: string
  authorizedByRole: string
}): PrintDocument {
  const priced = priceLines(input.lines)
  const carrying = lineAmount("1", input.carrying)
  const grand = moneyRound(priced.subtotal + carrying)
  const summary: SummaryRow[] = [{ label: "Sub Total", amount: formatMoney(priced.subtotal) }]
  if (carrying > 0) {
    summary.push({ label: "Carrying & Unloading", amount: formatMoney(carrying) })
  }
  summary.push({ label: "Grand Total", amount: formatMoney(grand), strong: true })

  return {
    kicker: "Purchase Order",
    title: printedSubtitle(input.subtitle, defaultSubtitles.purchaseOrder),
    numberLabel: "PO No.",
    documentNo: input.documentNo || "Assigned when saved",
    issuedOn: formatIsoDate(input.issuedOn),
    verifyUrl: input.verifyUrl,
    parties: [
      { heading: "Vendor", name: input.vendorName || "—", detail: input.vendorDetail },
      {
        heading: "Deliver To",
        name: input.projectName || "—",
        detail: [input.site.trim(), input.receiver.trim()].filter(Boolean).join("\n"),
      },
    ],
    facts: [
      { label: "Project Name", value: input.projectName || "—" },
      { label: "Site", value: input.site || "—" },
      { label: "Receiver", value: input.receiver || "—" },
      { label: "Delivery Date", value: input.deliveryOn ? formatIsoDate(input.deliveryOn) : "—" },
    ],
    intro: "",
    lines: priced.lines,
    milestonesTitle: "",
    milestones: [],
    wordsLabel: "Amount In Words",
    words: amountInWords(grand),
    summary,
    terms: input.terms.trim(),
    exclusions: "",
    notes: "",
    signatures: [
      { label: "Prepared By", name: input.preparedBy, detail: input.preparedByRole },
      { label: "Checked By", name: input.checkedBy, detail: input.checkedByRole },
      {
        label: "Authorized Signature",
        name: input.authorizedBy,
        detail: [input.authorizedByRole, documentCompanyName].filter(Boolean).join("\n"),
      },
    ],
  }
}

export function grandTotal(lines: LineInput[], aitPercent: string, extra = 0): number {
  const priced = priceLines(lines)
  return moneyRound(priced.subtotal + aitAmount(priced.subtotal, aitPercent) + extra)
}
