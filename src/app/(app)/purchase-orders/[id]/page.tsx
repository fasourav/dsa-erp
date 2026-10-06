import { VendorInvoicesPanel } from "@/app/(app)/purchase-orders/[id]/vendor-invoices-panel"
import { getVendorInvoicePage } from "@/lib/vendor-invoices"

export const metadata = { title: "Vendor Invoices" }

export default async function PurchaseOrderInvoicesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const page = await getVendorInvoicePage(id)

  return (
    <VendorInvoicesPanel
      purchaseOrder={page.purchaseOrder}
      invoices={page.invoices}
      paymentMethods={page.paymentMethods}
      expenseCategories={page.expenseCategories}
      bankAccounts={page.bankAccounts}
      error={page.error}
    />
  )
}
