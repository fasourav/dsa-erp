import { WorkOrderStudio } from "@/app/(app)/documents/work-orders/work-order-studio"
import { getPrintMargins } from "@/lib/company-settings"
import { requestOrigin } from "@/lib/documents/origin"
import { loadDocumentCatalog, loadWorkOrderDraft } from "@/lib/documents/queries"
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

  if (!loaded.draft) {
    return <p className="text-sm text-destructive">{loaded.error}</p>
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
        origin={origin}
        margins={margins}
      />
    </>
  )
}
