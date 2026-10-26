import { formatIsoDate, formatMoney } from "@/lib/format"
import { amountInWords } from "@/lib/documents/money"
import { verifyUrl } from "@/lib/documents/verify-url"
import type { DocumentModel, SignLine } from "@/lib/documents/setc/types"
import {
  documentCompanyName,
  isSignatureEnabled,
  roleFor,
  signatureName,
  type EmployeeChoice,
} from "@/lib/documents/drafts"

export const formSlugs = {
  rfqs: "rfq",
  challans: "delivery_challan",
  vouchers: "payment_voucher",
  certificates: "completion",
  "salary-slips": "salary_slip",
  letters: "letter",
} as const

export type FormSlug = keyof typeof formSlugs
export type FormKind = (typeof formSlugs)[FormSlug]

export function slugForKind(kind: FormKind): FormSlug {
  const match = (Object.entries(formSlugs) as Array<[FormSlug, FormKind]>).find(([, value]) => value === kind)
  return match?.[0] ?? "letters"
}

export function isFormSlug(value: string): value is FormSlug {
  return value in formSlugs
}

export type TextRow = { label: string; amount: string }
export type ChallanRow = {
  item: string
  specification: string
  unit: string
  ordered: string
  delivered: string
  remarks: string
}
export type RfqRow = {
  item: string
  specification: string
  unit: string
  quantity: string
  remarks: string
}
export type CheckRow = { item: string; status: string; remarks: string }
export type DutyRow = { project: string; site: string; person: string; phone: string }
export type NoteRow = { label: string; value: string }

export type FormBody = {
  subtitle: string
  preparedBy: string
  checkedBy: string
  authorizedBy: string
  submittedBy: string
  partyName: string
  partyDetail: string
  companyName: string
  projectName: string
  notes: string
  terms: string
  dueOn: string
  subject: string
  paragraphs: string
  cc: string
  letterKind: "letter" | "notice"
  audience: string
  clientWoNo: string
  dispatchedFrom: string
  vehicleNo: string
  driverName: string
  packages: string
  workOrderNo: string
  site: string
  startDate: string
  completionDate: string
  intro: string
  scope: string
  defect: string
  designation: string
  department: string
  joinedOn: string
  periodLabel: string
  workingDays: string
  attendance: string
  payMode: string
  accountNo: string
  againstRef: string
  billNo: string
  accountHead: string
  narration: string
  paymentMode: string
  challanLines: ChallanRow[]
  rfqLines: RfqRow[]
  inspections: CheckRow[]
  earnings: TextRow[]
  deductions: TextRow[]
  duty: DutyRow[]
  noticeRows: NoteRow[]
}

export type FormDraft = {
  id: string | null
  kind: FormKind
  documentNo: string
  verifyToken: string
  issuedOn: string
  projectId: string
  clientId: string
  vendorId: string
  purchaseOrderId: string
  vendorPaymentId: string
  operationalExpenseId: string
  payrollLineId: string
  employeeId: string
  lockedNet: number
  lockedGross: number
  lockedDeductions: number
  statusNote: string
  employeeCode: string
  body: FormBody
}

export function blankBody(): FormBody {
  return {
    subtitle: "",
    preparedBy: "",
    checkedBy: "",
    authorizedBy: "",
    submittedBy: "",
    partyName: "",
    partyDetail: "",
    companyName: "",
    projectName: "",
    notes: "",
    terms: "",
    dueOn: "",
    subject: "",
    paragraphs: "",
    cc: "",
    letterKind: "letter",
    audience: "",
    clientWoNo: "",
    dispatchedFrom: "",
    vehicleNo: "",
    driverName: "",
    packages: "",
    workOrderNo: "",
    site: "",
    startDate: "",
    completionDate: "",
    intro: "",
    scope: "",
    defect: "",
    designation: "",
    department: "",
    joinedOn: "",
    periodLabel: "",
    workingDays: "",
    attendance: "",
    payMode: "",
    accountNo: "",
    againstRef: "",
    billNo: "",
    accountHead: "",
    narration: "",
    paymentMode: "",
    challanLines: [{ item: "", specification: "", unit: "", ordered: "", delivered: "", remarks: "" }],
    rfqLines: [{ item: "", specification: "", unit: "", quantity: "", remarks: "" }],
    inspections: [{ item: "", status: "", remarks: "" }],
    earnings: [{ label: "", amount: "" }],
    deductions: [{ label: "", amount: "" }],
    duty: [],
    noticeRows: [{ label: "", value: "" }],
  }
}

function signs(
  body: FormBody,
  employees: EmployeeChoice[],
  extra: SignLine[] = [],
  preparedLabel = "Prepared By",
): SignLine[] {
  const rows: SignLine[] = []
  if (isSignatureEnabled(body.preparedBy)) {
    rows.push({
      label: preparedLabel,
      name: signatureName(body.preparedBy),
      detail: roleFor(employees, body.preparedBy),
    })
  }
  if (isSignatureEnabled(body.checkedBy)) {
    rows.push({
      label: "Checked By",
      name: signatureName(body.checkedBy),
      detail: roleFor(employees, body.checkedBy),
    })
  }
  if (isSignatureEnabled(body.authorizedBy)) {
    rows.push({
      label: "Authorized Signature",
      name: signatureName(body.authorizedBy),
      detail: roleFor(employees, body.authorizedBy),
    })
  }
  return [...rows, ...extra]
}

function moneyRows(rows: TextRow[]): Array<{ label: string; amount: number }> {
  return rows.flatMap((row) => {
    const label = row.label.trim()
    if (!label) return []
    const amount = Number(row.amount)
    return [{ label, amount: Number.isFinite(amount) ? amount : 0 }]
  })
}

function sumRows(rows: Array<{ amount: number }>): number {
  return Math.round(rows.reduce((total, row) => total + row.amount, 0) * 100) / 100
}

export function formToModel(draft: FormDraft, origin: string, employees: EmployeeChoice[]): DocumentModel {
  const url = verifyUrl(origin, draft.verifyToken)
  const issued = formatIsoDate(draft.issuedOn)
  const body = draft.body
  if (draft.kind === "rfq") {
    const period = [body.startDate, body.completionDate].filter(Boolean)
    const workPeriod =
      period.length === 2
        ? `${formatIsoDate(body.startDate)} – ${formatIsoDate(body.completionDate)}`
        : period.length === 1
          ? formatIsoDate(period[0] ?? "")
          : "—"
    const vendorDisplay = body.companyName.trim() || body.partyName.trim()
    const vendorSignDetail =
      body.companyName.trim() && body.companyName.trim() !== body.partyName.trim()
        ? `${body.companyName.trim()} - Signature, Seal & Date`
        : "Signature, Seal & Date"
    return {
      kind: "rfq",
      doc: {
        documentNo: draft.documentNo || "Assigned when saved",
        issuedOn: issued,
        verifyUrl: url,
        subtitle: body.subtitle.trim() || "Vendor / Service Provider",
        toName: body.partyName,
        toDetail: body.partyDetail,
        facts: [
          { label: "Vendor Name", value: vendorDisplay || "—" },
          { label: "Project Name", value: body.projectName || "—" },
          { label: "Submission Deadline", value: body.dueOn ? formatIsoDate(body.dueOn) : "—" },
          { label: "Tentative Work Period", value: workPeriod },
        ],
        subject: body.subject,
        intro: body.intro,
        lines: body.rfqLines.filter((line) => line.item.trim()),
        note: body.notes,
        terms: body.terms,
        signatures: signs(body, employees).map((line) =>
          line.label === "Authorized Signature"
            ? {
                ...line,
                detail: [line.detail, documentCompanyName].filter(Boolean).join("\n"),
              }
            : line,
        ),
        vendorSignature: isSignatureEnabled(body.submittedBy)
          ? {
              label: "Quotation Submitted By (Vendor)",
              name: body.partyName,
              detail: vendorSignDetail,
            }
          : null,
      },
    }
  }
  if (draft.kind === "delivery_challan") {
    return {
      kind: "challan",
      doc: {
        documentNo: draft.documentNo || "Assigned when saved",
        issuedOn: issued,
        verifyUrl: url,
        deliverToName: body.partyName,
        deliverToDetail: body.partyDetail,
        facts: [
          { label: "Project Name", value: body.projectName || "—" },
          { label: "Client WO No.", value: body.clientWoNo || "—" },
          { label: "Dispatched From", value: body.dispatchedFrom || "—" },
          { label: "Vehicle No.", value: body.vehicleNo || "—" },
          { label: "Driver Name", value: body.driverName || "—" },
        ],
        lines: body.challanLines.filter((line) => line.item.trim()),
        packages: body.packages,
        declaration: "",
        note: body.notes,
        signatures: [
          ...(isSignatureEnabled(body.preparedBy)
            ? [{
                label: "Dispatched By",
                name: signatureName(body.preparedBy),
                detail: roleFor(employees, body.preparedBy) || "Store In-Charge",
              }]
            : []),
          { label: "Delivered By", name: body.driverName, detail: "Driver" },
          { label: "Received By", name: "", detail: "Name, Signature & Date" },
        ],
      },
    }
  }
  if (draft.kind === "payment_voucher") {
    const deductions = moneyRows(body.deductions)
    const deducted = sumRows(deductions)
    const net = draft.lockedNet
    const lines = [
      {
        item: body.subject.trim() || "Payment",
        specification: body.narration,
        amount: Math.round((net + deducted) * 100) / 100,
      },
      ...deductions.map((row) => ({
        item: `Less: ${row.label}`,
        specification: "",
        amount: row.amount,
        deduct: true,
      })),
    ]
    return {
      kind: "voucher",
      doc: {
        documentNo: draft.documentNo || "Assigned when saved",
        issuedOn: issued,
        verifyUrl: url,
        paidToName: body.partyName,
        paidToDetail: body.partyDetail,
        facts: [
          { label: "Vendor Name", value: body.partyName || "—" },
          { label: "Project Name", value: body.projectName || "—" },
          { label: "Against WO No.", value: body.againstRef || "—" },
          { label: "Vendor Bill No.", value: body.billNo || "—" },
          { label: "Account Head", value: body.accountHead || "—" },
        ],
        lines,
        net,
        paymentMode: body.paymentMode,
        statusNote: draft.statusNote,
        narration: body.narration,
        note: body.notes,
        signatures: signs(body, employees, [
          { label: "Received By", name: body.partyName, detail: "Signature & Date" },
        ]),
      },
    }
  }
  if (draft.kind === "completion") {
    return {
      kind: "certificate",
      doc: {
        documentNo: draft.documentNo || "Assigned when saved",
        issuedOn: issued,
        verifyUrl: url,
        clientName: body.partyName,
        clientDetail: body.partyDetail,
        facts: [
          { label: "Project Name", value: body.projectName || "—" },
          { label: "Work Order No.", value: body.workOrderNo || "—" },
          { label: "Site Address", value: body.site || "—" },
          { label: "Start Date", value: body.startDate ? formatIsoDate(body.startDate) : "—" },
          { label: "Completion Date", value: body.completionDate ? formatIsoDate(body.completionDate) : "—" },
        ],
        intro: body.intro,
        scope: body.scope.split(/\n+/).map((line) => line.trim()).filter(Boolean),
        inspections: body.inspections.filter((row) => row.item.trim()),
        defect: body.defect,
        signatures: [
          {
            label: "Certified By",
            name: isSignatureEnabled(body.preparedBy) ? signatureName(body.preparedBy) : "",
            detail: isSignatureEnabled(body.preparedBy) ? roleFor(employees, body.preparedBy) : "",
          },
          {
            label: "Authorized Signature",
            name: isSignatureEnabled(body.authorizedBy) ? signatureName(body.authorizedBy) : "",
            detail: isSignatureEnabled(body.authorizedBy) ? roleFor(employees, body.authorizedBy) : "",
          },
          { label: "Accepted By (Client)", name: body.partyName, detail: "Signature & Date" },
        ],
      },
    }
  }
  if (draft.kind === "salary_slip") {
    const earnings = moneyRows(body.earnings)
    const deductions = moneyRows(body.deductions)
    const grossOk = Math.abs(sumRows(earnings) - draft.lockedGross) < 0.05
    const deductOk = Math.abs(sumRows(deductions) - draft.lockedDeductions) < 0.05
    return {
      kind: "salary",
      doc: {
        documentNo: draft.documentNo || "Assigned when saved",
        issuedOn: issued,
        verifyUrl: url,
        periodSubtitle: body.periodLabel || body.subtitle || "Pay Slip",
        employeeName: body.partyName,
        employeeDetail: [body.designation, body.department && `Department: ${body.department}`, body.joinedOn && `Date of Joining: ${formatIsoDate(body.joinedOn)}`]
          .filter(Boolean)
          .join("\n"),
        facts: [
          { label: "Pay Period", value: body.periodLabel || "—" },
          { label: "Working Days", value: body.workingDays || "—" },
          { label: "Days Present / Leave", value: body.attendance || "—" },
          { label: "Payment Mode", value: body.payMode || "—" },
          { label: "Account No.", value: body.accountNo || "—" },
        ],
        earnings: grossOk ? earnings : [{ label: "Earnings", amount: draft.lockedGross }],
        deductions: deductOk ? deductions : [{ label: "Deductions", amount: draft.lockedDeductions }],
        net: draft.lockedNet,
        notes: body.notes.split(/\n+/).map((line) => line.trim()).filter(Boolean),
        signatures: signs(body, employees, [
          { label: "Received By", name: body.partyName, detail: "Employee Signature & Date" },
        ]),
      },
    }
  }
  const notice = body.letterKind === "notice"
  return {
    kind: "letter",
    doc: {
      documentNo: draft.documentNo || "Assigned when saved",
      issuedOn: issued,
      verifyUrl: url,
      notice,
      audience: body.audience || (notice ? "For All Office & Site Staff" : "Official Correspondence"),
      addressee: letterLines(body),
      addresseeStrong: letterStrong(body),
      subject: body.subject,
      paragraphs: body.paragraphs.split(/\n\n+/).map((line) => line.trim()).filter(Boolean),
      rows: notice ? body.noticeRows.filter((row) => row.label.trim()) : [],
      duty: notice ? body.duty.filter((row) => row.project.trim() || row.person.trim()) : [],
      closing: "",
      cc: body.cc,
      signatures: signs(body, employees),
    },
  }
}

function letterLines(body: FormBody): string[] {
  const detail = body.partyDetail.split(/\n/).map((line) => line.trim()).filter(Boolean)
  const lines = [body.partyName.trim()]
  if (detail[0]) lines.push(detail[0])
  if (body.companyName.trim()) lines.push(body.companyName.trim())
  lines.push(...detail.slice(1))
  return lines.filter(Boolean)
}

function letterStrong(body: FormBody): boolean[] {
  const lines = letterLines(body)
  return lines.map((line, index) => index === 0 || line.replace(/\*/g, "").trim() === body.companyName.trim() || /^\*\*/.test(line))
}

export function formTitle(kind: FormKind): string {
  if (kind === "rfq") return "Request For Quotation"
  if (kind === "delivery_challan") return "Delivery Challan"
  if (kind === "payment_voucher") return "Payment Voucher"
  if (kind === "completion") return "Work Completion Certificate"
  if (kind === "salary_slip") return "Salary Slip"
  return "Letter / Notice"
}

export function lockedMoneyLabel(kind: FormKind, amount: number): string {
  if (kind === "salary_slip") return `Net pay on the payroll record: ${formatMoney(amount)} (${amountInWords(amount)})`
  if (kind === "payment_voucher") return `Amount recorded in the books: ${formatMoney(amount)} (${amountInWords(amount)})`
  return ""
}
