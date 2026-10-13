import { ReceiptStudio } from "@/app/(app)/documents/receipts/[id]/receipt-studio"
import { getPrintMargins } from "@/lib/company-settings"
import { requestOrigin } from "@/lib/documents/origin"
import { loadDocumentCatalog, loadReceiptDraft } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Money Receipt" }

export default async function ReceiptDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModule("client_invoices")
  const { id } = await params
  const [catalog, loaded, margins, origin] = await Promise.all([
    loadDocumentCatalog(),
    loadReceiptDraft(id),
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
      <ReceiptStudio
        draft={loaded.draft}
        employees={catalog.employees}
        paymentMethods={catalog.paymentMethods}
        origin={origin}
        margins={margins}
      />
    </>
  )
}
