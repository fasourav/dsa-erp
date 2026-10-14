import { QuotationStudio } from "@/app/(app)/documents/quotations/quotation-studio"
import { PageHeader } from "@/components/page-header"
import { getPrintMargins } from "@/lib/company-settings"
import { requestOrigin } from "@/lib/documents/origin"
import { loadDocumentCatalog, loadQuotationDraft } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Quotation" }

export default async function QuotationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModule("quotations")
  const { id } = await params
  const [catalog, loaded, margins, origin] = await Promise.all([
    loadDocumentCatalog(),
    loadQuotationDraft(id),
    getPrintMargins(),
    requestOrigin(),
  ])

  if (!loaded.draft) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Quotation" />
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
      <QuotationStudio
        draft={loaded.draft}
        clients={catalog.clients}
        projects={catalog.projects}
        employees={catalog.employees}
        origin={origin}
        margins={margins}
      />
    </>
  )
}
