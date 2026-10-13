import { DocumentList } from "@/components/documents/document-list"
import { listInvoiceDocuments } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Client Invoices" }

export default async function InvoiceDocumentsPage() {
  await requireModule("client_invoices")
  const page = await listInvoiceDocuments()

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">Client Invoices</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Open an invoice to prepare the printable bill.
        </p>
      </div>
      {page.error ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error}
        </p>
      ) : null}
      <DocumentList
        items={page.items}
        hrefBase="/documents/invoices"
        empty="No client invoices yet."
        exportName="client-invoice-documents"
        exportTitle="Client Invoices"
      />
    </div>
  )
}
