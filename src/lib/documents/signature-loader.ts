import type { ModuleKey } from "@/lib/access"
import { STAMP_PREFIX, type SignatureStamps, type StampKind } from "@/lib/documents/signature-stamps"
import { attachSignatureUrls, signatureImagePaths } from "@/lib/documents/signature-urls"
import type { DocumentModel } from "@/lib/documents/setc/types"
import { mediaDataUrl, signedMediaUrls } from "@/lib/profile-media"

export async function inlineSignatureImages(model: DocumentModel): Promise<DocumentModel> {
  const urls: Record<string, string> = {}
  await Promise.all(
    signatureImagePaths(model)
      .filter((path) => path.startsWith(STAMP_PREFIX) && !path.includes(".."))
      .map(async (path) => {
        const data = await mediaDataUrl(path)
        if (data) urls[path] = data
      }),
  )
  return attachSignatureUrls(model, urls)
}

export async function previewStampUrls(stamps: SignatureStamps) {
  return signedMediaUrls(Object.values(stamps).flatMap((stamp) => (stamp ? [stamp.imagePath] : [])))
}

export type RecordTarget = {
  table: "quotations" | "work_orders" | "issued_documents"
  key: "id" | "client_invoice_id" | "client_payment_id" | "purchase_order_id"
  module: ModuleKey
  names: "column" | "body"
  page: (id: string) => string
}

export function recordTarget(kind: StampKind): RecordTarget {
  switch (kind) {
    case "quotation":
      return {
        table: "quotations",
        key: "id",
        module: "quotations",
        names: "column",
        page: (id) => `/documents/quotations/${id}`,
      }
    case "work_order":
      return {
        table: "work_orders",
        key: "id",
        module: "work_orders",
        names: "column",
        page: (id) => `/documents/work-orders/${id}`,
      }
    case "invoice":
      return {
        table: "issued_documents",
        key: "client_invoice_id",
        module: "client_invoices",
        names: "body",
        page: (id) => `/documents/invoices/${id}`,
      }
    case "receipt":
      return {
        table: "issued_documents",
        key: "client_payment_id",
        module: "client_invoices",
        names: "body",
        page: (id) => `/documents/receipts/${id}`,
      }
    case "purchase_order":
      return {
        table: "issued_documents",
        key: "purchase_order_id",
        module: "purchase_orders",
        names: "body",
        page: (id) => `/documents/purchase-orders/${id}`,
      }
  }
}
