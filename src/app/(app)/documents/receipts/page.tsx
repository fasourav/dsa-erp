import { DocumentList } from "@/components/documents/document-list"
import { listReceiptDocuments } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Money Receipts" }

export default async function ReceiptDocumentsPage() {
  await requireModule("client_invoices")
  const page = await listReceiptDocuments()

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Money Receipts</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open a payment to prepare the printable receipt.
        </p>
      </div>
      {page.error ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error}
        </p>
      ) : null}
      <DocumentList
        items={page.items}
        hrefBase="/documents/receipts"
        empty="No client payments yet."
        exportName="money-receipts"
        exportTitle="Money Receipts"
      />
    </div>
  )
}
