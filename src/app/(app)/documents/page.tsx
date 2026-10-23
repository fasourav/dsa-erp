import Link from "next/link"
import { redirect } from "next/navigation"
import { Banknote, ClipboardList, FileText, Receipt, ScrollText, Trash2, type LucideIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { canViewDocumentKind, documentKinds } from "@/lib/documents/kinds"
import { getAccess } from "@/lib/permissions"
import { cn } from "@/lib/utils"

export const metadata = { title: "Documents" }

const chartTiles = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"] as const

const kindIcons: Record<string, LucideIcon> = {
  "/documents/quotations": FileText,
  "/documents/work-orders": ClipboardList,
  "/documents/purchase-orders": Receipt,
  "/documents/invoices": ScrollText,
  "/documents/receipts": Banknote,
}

export default async function DocumentsPage() {
  const access = await getAccess()
  if (!access || access.status === "deactivated") redirect("/login")
  const visible = documentKinds.filter((kind) => canViewDocumentKind(access, kind))
  if (visible.length === 0) redirect("/no-access")

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <PageHeader
        title="Documents"
        description="Prepare a document. Download the letterhead PDF, or print the content for a pre-printed pad."
      />
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((kind, index) => {
          const Icon = kindIcons[kind.href] ?? FileText
          return (
            <Link
              key={kind.href}
              href={kind.href}
              className="block rounded-card focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full gap-3 transition-colors hover:bg-fill">
                <CardContent className="flex flex-col gap-3">
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-tile text-on-color tile-sheen",
                      chartTiles[index % chartTiles.length],
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-panel-title">{kind.title}</span>
                  <span className="text-label text-muted-foreground">{kind.detail}</span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
        {access.isOwner ? (
          <Link
            href="/documents/trash"
            className="block rounded-card focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full gap-3 transition-colors hover:bg-fill">
              <CardContent className="flex flex-col gap-3">
                <span className="flex size-9 items-center justify-center rounded-tile bg-chart-5 text-on-color tile-sheen">
                  <Trash2 aria-hidden="true" className="size-4" />
                </span>
                <span className="text-panel-title">Trash</span>
                <span className="text-label text-muted-foreground">
                  Restore a document or delete it forever.
                </span>
              </CardContent>
            </Card>
          </Link>
        ) : null}
      </div>
    </div>
  )
}
