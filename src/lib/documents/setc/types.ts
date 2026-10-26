import type { PrintDocument } from "@/lib/documents/present"

export type SignLine = { label: string; name: string; detail: string }

export type ChallanLine = {
  item: string
  specification: string
  unit: string
  ordered: string
  delivered: string
  remarks: string
}

export type ChallanModel = {
  documentNo: string
  issuedOn: string
  verifyUrl: string | null
  deliverToName: string
  deliverToDetail: string
  facts: Array<{ label: string; value: string }>
  lines: ChallanLine[]
  packages: string
  declaration: string
  note: string
  signatures: SignLine[]
}

export type VoucherLine = {
  item: string
  specification: string
  amount: number
  deduct?: boolean
}

export type VoucherModel = {
  documentNo: string
  issuedOn: string
  verifyUrl: string | null
  paidToName: string
  paidToDetail: string
  facts: Array<{ label: string; value: string }>
  lines: VoucherLine[]
  net: number
  paymentMode: string
  statusNote: string
  narration: string
  note: string
  signatures: SignLine[]
}

export type CertificateModel = {
  documentNo: string
  issuedOn: string
  verifyUrl: string | null
  clientName: string
  clientDetail: string
  facts: Array<{ label: string; value: string }>
  intro: string
  scope: string[]
  inspections: Array<{ item: string; status: string; remarks: string }>
  defect: string
  signatures: SignLine[]
}

export type SalaryModel = {
  documentNo: string
  issuedOn: string
  verifyUrl: string | null
  periodSubtitle: string
  employeeName: string
  employeeDetail: string
  facts: Array<{ label: string; value: string }>
  earnings: Array<{ label: string; amount: number }>
  deductions: Array<{ label: string; amount: number }>
  net: number
  notes: string[]
  signatures: SignLine[]
}

export type LetterModel = {
  documentNo: string
  issuedOn: string
  verifyUrl: string | null
  notice: boolean
  audience: string
  addressee: string[]
  addresseeStrong?: boolean[]
  subject: string
  paragraphs: string[]
  rows: Array<{ label: string; value: string }>
  duty: Array<{ project: string; site: string; person: string; phone: string }>
  closing: string
  cc: string
  signatures: SignLine[]
}

export type RfqLine = {
  item: string
  specification: string
  unit: string
  quantity: string
  remarks: string
}

/** Vendor-facing request for a price. No unit price or amount is printed. */
export type RfqModel = {
  documentNo: string
  issuedOn: string
  verifyUrl: string | null
  subtitle: string
  vendorName: string
  vendorDetail: string
  facts: Array<{ label: string; value: string }>
  subject: string
  lines: RfqLine[]
  notes: string
  signatures: SignLine[]
}

export const savedRecordKinds = [
  "quotation",
  "work_order",
  "invoice",
  "receipt",
  "purchase_order",
  "delivery_challan",
  "payment_voucher",
  "completion",
  "salary_slip",
  "letter",
  "rfq",
] as const

export type SavedRecordKind = (typeof savedRecordKinds)[number]

export type DocumentModel =
  | { kind: "print"; doc: PrintDocument }
  | { kind: "challan"; doc: ChallanModel }
  | { kind: "voucher"; doc: VoucherModel }
  | { kind: "certificate"; doc: CertificateModel }
  | { kind: "salary"; doc: SalaryModel }
  | { kind: "letter"; doc: LetterModel }
  | { kind: "rfq"; doc: RfqModel }

export function documentNumberOf(model: DocumentModel): string {
  return model.doc.documentNo
}
