import { WorkOrderStudio } from "@/app/(app)/documents/work-orders/work-order-studio"
import { PageHeader } from "@/components/page-header"
import { getPrintMargins } from "@/lib/company-settings"
import { requestOrigin } from "@/lib/documents/origin"
import { loadDocumentCatalog, loadPurchaseOrderChoices, loadWorkOrderDraft } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Work Order" }

export default async function WorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModule("work_orders")
  const { id } = await params
  const [catalog, loaded, margins, origin] = await Promise.all([
    loadDocumentCatalog(),
    loadWorkOrderDraft(id),
    getPrintMargins(),
    requestOrigin(),
  ])
  const purchaseOrders = await loadPurchaseOrderChoices(catalog)

  if (!loaded.draft) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Work Order" />
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
      <WorkOrderStudio
        draft={loaded.draft}
        vendors={catalog.vendors}
        projects={catalog.projects}
        employees={catalog.employees}
        purchaseOrders={purchaseOrders}
        origin={origin}
        margins={margins}
      />
    </>
  )
}
