import Link from "next/link"
import { redirect } from "next/navigation"

import { allows, homePath, type ModuleKey } from "@/lib/access"
import { getAccess } from "@/lib/permissions"

export const metadata = { title: "Documents" }

const kinds: Array<{ href: string; module: ModuleKey; title: string; detail: string }> = [
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

export default async function DocumentsPage() {
  const access = await getAccess()
  if (!access || access.status === "deactivated") redirect("/login")
  const visible = kinds.filter((kind) => allows(access, kind.module, "view"))
  if (visible.length === 0) redirect(homePath(access))

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Documents</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Prepare a printable document. Output is the content only, so it sits on the letterhead pad.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((kind) => (
          <Link
            key={kind.href}
            href={kind.href}
            className="flex min-h-28 flex-col justify-between rounded-xl border border-border bg-card p-5 hover:bg-accent"
          >
            <span className="font-medium">{kind.title}</span>
            <span className="text-sm text-muted-foreground">{kind.detail}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
