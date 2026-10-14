import { documentExportGrid, DocumentList } from "@/components/documents/document-list"
import { ListExport } from "@/components/list-export"
import { PageHeader } from "@/components/page-header"
import { listReceiptDocuments } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Money Receipts" }

export default async function ReceiptDocumentsPage() {
  await requireModule("client_invoices")
  const page = await listReceiptDocuments()

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <PageHeader
        title="Money Receipts"
        description="Open a payment to prepare the printable receipt."
        actions={<ListExport grid={documentExportGrid(page.items, "money-receipts", "Money Receipts")} />}
      />
      {page.error ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error}
        </p>
      ) : null}
      <DocumentList
        items={page.items}
        hrefBase="/documents/receipts"
        empty="No Client Payments Yet."
        pagingLabel="Money receipts pagination"
      />
    </div>
  )
}
