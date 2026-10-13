import Link from "next/link"

import { DocumentList } from "@/components/documents/document-list"
import { Button } from "@/components/ui/button"
import { allows } from "@/lib/access"
import { listQuotations } from "@/lib/documents/queries"
import { getAccess, requireModule } from "@/lib/permissions"

export const metadata = { title: "Quotations" }

export default async function QuotationsPage() {
  await requireModule("quotations")
  const [page, access] = await Promise.all([listQuotations(), getAccess()])
  const canAdd = access ? allows(access, "quotations", "add") : false

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Quotations</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Estimates and financial proposals.
          </p>
        </div>
        {canAdd ? (
          <Button type="button" className="w-full sm:w-fit" render={<Link href="/documents/quotations/new" />}>
            New quotation
          </Button>
        ) : null}
      </div>
      {page.error ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error}
        </p>
      ) : null}
      <DocumentList
        items={page.items}
        hrefBase="/documents/quotations"
        empty="No quotations yet."
      />
    </div>
  )
}
