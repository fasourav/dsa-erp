import Link from "next/link"
import { Plus } from "lucide-react"

import { documentExportGrid, DocumentList } from "@/components/documents/document-list"
import { ListExport } from "@/components/list-export"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { allows } from "@/lib/access"
import { listWorkOrders } from "@/lib/documents/queries"
import { getAccess, requireModule } from "@/lib/permissions"

export const metadata = { title: "Work Orders" }

export default async function WorkOrdersPage() {
  await requireModule("work_orders")
  const [page, access] = await Promise.all([listWorkOrders(), getAccess()])
  const canAdd = access ? allows(access, "work_orders", "add") : false

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <PageHeader
        title="Work Orders"
        description="Printable work order for a purchase order."
        actions={
          <>
            <ListExport grid={documentExportGrid(page.items, "work-orders", "Work Orders")} />
            {canAdd ? (
              <Button nativeButton={false} render={<Link href="/documents/work-orders/new" />}>
                <Plus aria-hidden="true" data-icon="inline-start" />
                New Work Order
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
        hrefBase="/documents/work-orders"
        empty="No Work Orders Yet."
        pagingLabel="Work orders pagination"
      />
    </div>
  )
}
