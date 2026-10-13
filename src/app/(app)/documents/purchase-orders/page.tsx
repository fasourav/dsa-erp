import { DocumentList } from "@/components/documents/document-list"
import { listPurchaseOrderDocuments } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Purchase Orders" }

export default async function PurchaseOrderDocumentsPage() {
  await requireModule("purchase_orders")
  const page = await listPurchaseOrderDocuments()

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Purchase Orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open a purchase order to prepare the printable order.
        </p>
      </div>
      {page.error ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error}
        </p>
      ) : null}
      <DocumentList
        items={page.items}
        hrefBase="/documents/purchase-orders"
        empty="No purchase orders yet."
        exportName="purchase-order-documents"
        exportTitle="Purchase Orders"
      />
    </div>
  )
}
