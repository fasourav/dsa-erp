import Link from "next/link"
import { Plus } from "lucide-react"

import { documentExportGrid, DocumentList } from "@/components/documents/document-list"
import { ListExport } from "@/components/list-export"
import { PageHeader } from "@/components/page-header"
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
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <PageHeader
        title="Quotations"
        description="Estimates and financial proposals."
        actions={
          <>
            <ListExport grid={documentExportGrid(page.items, "quotations", "Quotations")} />
            {canAdd ? (
              <Button nativeButton={false} render={<Link href="/documents/quotations/new" />}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                New Quotation
              </Button>
            ) : null}
          </>
        }
      />
      {page.error ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error}
        </p>
      ) : null}
      <DocumentList
        items={page.items}
        hrefBase="/documents/quotations"
        empty="No Quotations Yet."
        pagingLabel="Quotations pagination"
      />
    </div>
  )
}
