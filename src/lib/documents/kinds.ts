import type { ModuleKey } from "@/lib/access"

export const documentKinds: Array<{
  href: string
  module: ModuleKey
  title: string
  detail: string
}> = [
  {
    href: "/documents/quotations",
    module: "quotations",
    title: "Quotation",
    detail: "Estimate and financial proposal for a client.",
  },
  {
    href: "/documents/work-orders",
    module: "work_orders",
    title: "Work Order",
    detail: "Vendor work order with items and payment terms.",
  },
  {
    href: "/documents/purchase-orders",
    module: "purchase_orders",
    title: "Purchase Order",
    detail: "Print a purchase order from an existing order.",
  },
  {
    href: "/documents/invoices",
    module: "client_invoices",
    title: "Client Invoice",
    detail: "Print a bill from an existing client invoice.",
  },
  {
    href: "/documents/receipts",
    module: "client_invoices",
    title: "Money Receipt",
    detail: "Acknowledge a payment already recorded.",
  },
]
