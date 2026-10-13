import { QuotationStudio } from "@/app/(app)/documents/quotations/quotation-studio"
import { getPrintMargins } from "@/lib/company-settings"
import { requestOrigin } from "@/lib/documents/origin"
import { loadDocumentCatalog, loadQuotationDraft } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "New Quotation" }

export default async function NewQuotationPage() {
  await requireModule("quotations")
  const [catalog, loaded, margins, origin] = await Promise.all([
    loadDocumentCatalog(),
    loadQuotationDraft(null),
    getPrintMargins(),
    requestOrigin(),
  ])

  if (!loaded.draft) {
    return <p className="text-sm text-destructive">{loaded.error}</p>
  }

  return (
    <QuotationStudio
      draft={loaded.draft}
      clients={catalog.clients}
      projects={catalog.projects}
      employees={catalog.employees}
      origin={origin}
      margins={margins}
    />
  )
}
