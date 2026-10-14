import { WorkOrderStudio } from "@/app/(app)/documents/work-orders/work-order-studio"
import { PageHeader } from "@/components/page-header"
import { getPrintMargins } from "@/lib/company-settings"
import { requestOrigin } from "@/lib/documents/origin"
import { loadDocumentCatalog, loadWorkOrderDraft } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "New Work Order" }

export default async function NewWorkOrderPage() {
  await requireModule("work_orders")
  const [catalog, loaded, margins, origin] = await Promise.all([
    loadDocumentCatalog(),
    loadWorkOrderDraft(null),
    getPrintMargins(),
    requestOrigin(),
  ])

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
      draft={loaded.draft}
      vendors={catalog.vendors}
      projects={catalog.projects}
      employees={catalog.employees}
      origin={origin}
      margins={margins}
    />
  )
}
