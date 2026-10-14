import { PurchaseOrderStudio } from "@/app/(app)/documents/purchase-orders/[id]/purchase-order-studio"
import { PageHeader } from "@/components/page-header"
import { getPrintMargins } from "@/lib/company-settings"
import { requestOrigin } from "@/lib/documents/origin"
import { loadDocumentCatalog, loadPurchaseOrderDraft } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Purchase Order" }

export default async function PurchaseOrderDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModule("purchase_orders")
  const { id } = await params
  const [catalog, loaded, margins, origin] = await Promise.all([
    loadDocumentCatalog(),
    loadPurchaseOrderDraft(id),
    getPrintMargins(),
    requestOrigin(),
  ])

  if (!loaded.draft) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Purchase Order" />
        <p role="alert" className="text-sm text-destructive">
          {loaded.error}
        </p>
      </div>
    )
  }

  return (
    <>
      {loaded.error ? (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {loaded.error}
        </p>
      ) : null}
      <PurchaseOrderStudio
        draft={loaded.draft}
        employees={catalog.employees}
        origin={origin}
        margins={margins}
      />
    </>
  )
}
