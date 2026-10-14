import { documentExportGrid, DocumentList } from "@/components/documents/document-list"
import { ListExport } from "@/components/list-export"
import { PageHeader } from "@/components/page-header"
import { listInvoiceDocuments } from "@/lib/documents/queries"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Client Invoices" }

export default async function InvoiceDocumentsPage() {
  await requireModule("client_invoices")
  const page = await listInvoiceDocuments()

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <PageHeader
        title="Client Invoices"
        description="Open an invoice to prepare the printable bill."
        actions={
          <ListExport
            grid={documentExportGrid(page.items, "client-invoice-documents", "Client Invoices")}
          />
        }
      />
      {page.error ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error}
        </p>
      ) : null}
      <DocumentList
        items={page.items}
        hrefBase="/documents/invoices"
        empty="No Client Invoices Yet."
        pagingLabel="Client invoices pagination"
      />
    </div>
  )
}
