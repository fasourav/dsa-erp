import { documentExportGrid, DocumentList } from "@/components/documents/document-list"
import { ListExport } from "@/components/list-export"
import { PageHeader } from "@/components/page-header"
import { listPurchaseOrderDocuments } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Purchase Orders" }

export default async function PurchaseOrderDocumentsPage() {
  await requireModule("purchase_orders")
  const page = await listPurchaseOrderDocuments()

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <PageHeader
        title="Purchase Orders"
        description="Open a purchase order to prepare the printable order."
        actions={
          <ListExport
            grid={documentExportGrid(page.items, "purchase-order-documents", "Purchase Orders")}
          />
        }
      />
      {page.error ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error}
        </p>
      ) : null}
      <DocumentList
        items={page.items}
        hrefBase="/documents/purchase-orders"
        empty="No Purchase Orders Yet."
        pagingLabel="Purchase orders pagination"
      />
    </div>
  )
}
