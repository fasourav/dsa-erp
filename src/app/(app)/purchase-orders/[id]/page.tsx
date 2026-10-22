import { VendorInvoicesPanel } from "@/app/(app)/purchase-orders/[id]/vendor-invoices-panel"
import { workOrderForPurchaseOrder } from "@/lib/documents/queries"
import { getVendorInvoicePage } from "@/lib/vendor-invoices"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Vendor Payments" }

export default async function PurchaseOrderInvoicesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModule("purchase_orders")
  const { id } = await params
  const [page, workOrderId] = await Promise.all([getVendorInvoicePage(id), workOrderForPurchaseOrder(id)])

  return (
    <VendorInvoicesPanel
      purchaseOrder={page.purchaseOrder}
      invoices={page.invoices}
      paymentMethods={page.paymentMethods}
      bankAccounts={page.bankAccounts}
      error={page.error}
      workOrderId={workOrderId}
    />
  )
}
