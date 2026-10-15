import { WorkOrderStudio } from "@/app/(app)/documents/work-orders/work-order-studio"
import { PageHeader } from "@/components/page-header"
import { getPrintMargins } from "@/lib/company-settings"
import { requestOrigin } from "@/lib/documents/origin"
import { listActiveDocumentTemplates } from "@/lib/document-templates-data"
import { loadDocumentCatalog, loadPurchaseOrderChoices, loadWorkOrderDraft } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "New Work Order" }

export default async function NewWorkOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ po?: string }>
}) {
  await requireModule("work_orders")
  const { po } = await searchParams
  const [catalog, loaded, margins, origin, templateList] = await Promise.all([
    loadDocumentCatalog(),
    loadWorkOrderDraft(null),
    getPrintMargins(),
    requestOrigin(),
    listActiveDocumentTemplates("work_order"),
  ])
  const purchaseOrders = await loadPurchaseOrderChoices(catalog)

  if (!loaded.draft) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="New Work Order" />
        <p role="alert" className="text-sm text-destructive">
          {loaded.error}
        </p>
      </div>
    )
  }

  return (
    <WorkOrderStudio
      draft={
        po && purchaseOrders.some((item) => item.id === po)
          ? { ...loaded.draft, purchaseOrderId: po }
          : loaded.draft
      }
      vendors={catalog.vendors}
      projects={catalog.projects}
      employees={catalog.employees}
      purchaseOrders={purchaseOrders}
      origin={origin}
      margins={margins}
      templates={templateList.templates}
    />
  )
}
