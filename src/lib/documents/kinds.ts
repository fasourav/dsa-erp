import { allows, type AccessSnapshot, type ModuleKey } from "@/lib/access"

export const documentKinds: Array<{
  href: string
  module: ModuleKey
  anyOf?: ModuleKey[]
  title: string
  detail: string
}> = [
  {
    href: "/documents/quotations",
    module: "quotations",
    title: "Quotation",
    detail: "Estimate and financial proposal for a client, project, or lead.",
  },
  {
    href: "/documents/work-orders",
    module: "work_orders",
    title: "Work Order",
    detail: "Printable work order for a purchase order.",
  },
  {
    href: "/documents/purchase-orders",
    module: "purchase_orders",
    title: "Purchase Order",
    detail: "Print a purchase order from an existing order.",
  },
  {
    href: "/documents/challans",
    module: "purchase_orders",
    anyOf: ["purchase_orders", "projects"],
    title: "Delivery Challan",
    detail: "Goods dispatched from a purchase order or a project.",
  },
  {
    href: "/documents/invoices",
    module: "client_invoices",
    title: "Bill / Invoice",
    detail: "Print a bill from an existing client invoice.",
  },
  {
    href: "/documents/receipts",
    module: "client_invoices",
    title: "Money Receipt",
    detail: "Acknowledge a payment already recorded.",
  },
  {
    href: "/documents/vouchers",
    module: "vendor_payments",
    anyOf: ["vendor_payments", "expenses"],
    title: "Payment Voucher",
    detail: "A recorded vendor payment or operational expense.",
  },
  {
    href: "/documents/certificates",
    module: "projects",
    title: "Work Completion Certificate",
    detail: "Handover and acceptance for a project.",
  },
  {
    href: "/documents/salary-slips",
    module: "payroll",
    title: "Salary Slip",
    detail: "Pay slip from payroll and the employee record.",
  },
  {
    href: "/documents/letters",
    module: "projects",
    anyOf: ["projects", "clients"],
    title: "Letter / Notice",
    detail: "A letter or a notice, with an optional client or project.",
  },
]

export function canViewDocumentKind(
  access: AccessSnapshot,
  kind: (typeof documentKinds)[number],
): boolean {
  return (kind.anyOf ?? [kind.module]).some((module) => allows(access, module, "view"))
}
