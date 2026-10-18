export const documentCompanyName = "DynamicSpace Architects & Engineers"

export const defaultSubtitles = {
  quotation: "Estimate & Financial Proposal",
  workOrder: "Vendor / Service Provider",
  purchaseOrder: "Materials Procurement",
  invoice: "Final Bill",
  receipt: "Payment Acknowledgement",
} as const

export function printedSubtitle(value: string, fallback: string): string {
  const trimmed = value.trim()
  return trimmed || fallback
}

export const DEFAULT_PRINT_MARGIN_TOP_MM = 32
export const DEFAULT_PRINT_MARGIN_BOTTOM_MM = 28

/** Top of the letterhead footer artwork, including the raised logo block. */
export const LETTERHEAD_FOOTER_MM = 46
const LETTERHEAD_FOOTER_GAP_MM = 12

/** Content, including the signature row, stays above the footer artwork while respecting bottomMm adjustments. */
export function contentFloorMm(bottomMm: number): number {
  const offset = clampPrintMargin(bottomMm, DEFAULT_PRINT_MARGIN_BOTTOM_MM) - DEFAULT_PRINT_MARGIN_BOTTOM_MM
  return Math.max(0, LETTERHEAD_FOOTER_MM + LETTERHEAD_FOOTER_GAP_MM + offset)
}

export const SIGNATURE_OFF = "__off__"

export function isSignatureEnabled(value: string): boolean {
  return value !== SIGNATURE_OFF
}

export function signatureName(value: string): string {
  return value === SIGNATURE_OFF ? "" : value
}

export type PrintMargins = {
  topMm: number
  bottomMm: number
}

export type LineInput = {
  section: string
  item: string
  specification: string
  quantity: string
  unit: string
  unitPrice: string
}

export type MilestoneInput = {
  label: string
  percent: string
}

export type NamedOption = {
  id: string
  name: string
  detail: string
  companyName: string
  personName: string
}

export type ProjectChoice = {
  id: string
  name: string
  clientId: string
  location: string
}

export type EmployeeChoice = {
  name: string
  designation: string
}

export type CatalogChoice = {
  name: string
}

export const quotationStatuses = [
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "void", label: "Void" },
] as const

export const workOrderStatuses = [
  { value: "draft", label: "Draft" },
  { value: "issued", label: "Issued" },
  { value: "accepted", label: "Accepted" },
  { value: "completed", label: "Completed" },
  { value: "void", label: "Void" },
] as const

export type QuotationStatus = (typeof quotationStatuses)[number]["value"]
export type WorkOrderStatus = (typeof workOrderStatuses)[number]["value"]

export function clampPrintMargin(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.min(80, Math.max(0, Math.round(value)))
}

export function partyDetail(parts: Array<string | null | undefined>): string {
  return parts
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join("\n")
}

export function blankLine(): LineInput {
  return {
    section: "",
    item: "",
    specification: "",
    quantity: "",
    unit: "",
    unitPrice: "",
  }
}

export function blankMilestone(): MilestoneInput {
  return { label: "", percent: "" }
}

export function statusLabel(value: string): string {
  const known: Record<string, string> = {
    draft: "Draft",
    issued: "Issued",
    accepted: "Accepted",
    declined: "Declined",
    completed: "Completed",
    void: "Void",
    unpaid: "Unpaid",
    partial: "Partial",
    paid: "Paid",
    received: "Received",
  }
  return known[value] ?? value
}

export function isQuotationStatus(value: string): value is QuotationStatus {
  return quotationStatuses.some((status) => status.value === value)
}

export function isWorkOrderStatus(value: string): value is WorkOrderStatus {
  return workOrderStatuses.some((status) => status.value === value)
}

export function roleFor(employees: EmployeeChoice[], name: string): string {
  const clean = signatureName(name).trim()
  if (!clean) return ""
  const exact = employees.find((employee) => employee.name === clean)
  if (exact) return exact.designation
  const lower = clean.toLowerCase()
  return employees.find((employee) => employee.name.trim().toLowerCase() === lower)?.designation ?? ""
}

export function customerDisplayName(
  client: { companyName: string; personName: string; name: string } | undefined,
): string {
  if (!client) return "—"
  return client.companyName || client.personName || client.name || "—"
}
