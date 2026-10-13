import { InvoiceStudio } from "@/app/(app)/documents/invoices/[id]/invoice-studio"
import { getPrintMargins } from "@/lib/company-settings"
import { requestOrigin } from "@/lib/documents/origin"
import { loadDocumentCatalog, loadInvoiceDraft } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Client Invoice" }

export default async function InvoiceDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModule("client_invoices")
  const { id } = await params
  const [catalog, loaded, margins, origin] = await Promise.all([
    loadDocumentCatalog(),
    loadInvoiceDraft(id),
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
      <InvoiceStudio
        draft={loaded.draft}
        employees={catalog.employees}
        origin={origin}
        margins={margins}
      />
    </>
  )
}
