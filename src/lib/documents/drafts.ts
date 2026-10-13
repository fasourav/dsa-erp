export const documentCompanyName = "DynamicSpace Architects & Engineers"

export const DEFAULT_PRINT_MARGIN_TOP_MM = 32
export const DEFAULT_PRINT_MARGIN_BOTTOM_MM = 28

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
  return employees.find((employee) => employee.name === name)?.designation ?? ""
}

export function customerDisplayName(
  client: { companyName: string; personName: string; name: string } | undefined,
): string {
  if (!client) return "—"
  return client.companyName || client.personName || client.name || "—"
}
