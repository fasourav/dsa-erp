import type { ModuleKey } from "@/lib/access"

export const attachmentParents = [
  "client_invoice",
  "vendor_invoice",
  "purchase_order",
  "expense",
  "client_payment",
  "vendor_payment",
  "project",
  "client",
  "vendor",
  "employee",
  "asset",
  "bank_transaction",
  "quotation",
  "work_order",
  "issued_document",
] as const

export type AttachmentParent = (typeof attachmentParents)[number]

export const ATTACHMENT_BYTE_LIMIT = 10 * 1024 * 1024

export const attachmentMimeTypes = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const

export type AttachmentMime = keyof typeof attachmentMimeTypes

const parentModules: Record<Exclude<AttachmentParent, "issued_document">, ModuleKey> = {
  client_invoice: "client_invoices",
  vendor_invoice: "vendor_payments",
  purchase_order: "purchase_orders",
  expense: "expenses",
  client_payment: "client_invoices",
  vendor_payment: "vendor_payments",
  project: "projects",
  client: "clients",
  vendor: "vendors",
  employee: "employees",
  asset: "assets",
  bank_transaction: "banking",
  quotation: "quotations",
  work_order: "work_orders",
}

export function isAttachmentParent(value: string): value is AttachmentParent {
  return attachmentParents.includes(value as AttachmentParent)
}

export function attachmentModule(parentType: AttachmentParent): ModuleKey | null {
  if (parentType === "issued_document") return null
  return parentModules[parentType]
}

export function attachmentExtension(type: string): string | null {
  if (type === "image/jpg") return "jpg"
  return attachmentMimeTypes[type as AttachmentMime] ?? null
}

export function attachmentKind(type: string): "pdf" | "image" | "file" {
  if (type === "application/pdf") return "pdf"
  if (type === "image/jpeg" || type === "image/jpg" || type === "image/png" || type === "image/webp") {
    return "image"
  }
  return "file"
}

export function safeFileLabel(name: string): string {
  const trimmed = name.replace(/[/\\]/g, " ").replace(/\s+/g, " ").trim()
  return trimmed.slice(0, 180) || "File"
}

// The browser-supplied type and the file name can both be faked, so check the
// leading bytes match the declared format before the file is stored.
export function matchesAttachmentSignature(type: string, bytes: Uint8Array): boolean {
  const starts = (...sig: number[]) => sig.every((value, index) => bytes[index] === value)
  const ascii = (offset: number, text: string) =>
    [...text].every((char, index) => bytes[offset + index] === char.charCodeAt(0))
  switch (type) {
    case "application/pdf":
      return ascii(0, "%PDF-")
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff)
    case "image/webp":
      return ascii(0, "RIFF") && ascii(8, "WEBP")
    case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return starts(0x50, 0x4b, 0x03, 0x04)
    default:
      return false
  }
}
