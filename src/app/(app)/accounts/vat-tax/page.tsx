import { VatTaxTable } from "@/app/(app)/accounts/vat-tax/vat-tax-table"
import { getVatTaxPayments } from "@/lib/vat-tax"

export const metadata = { title: "VAT / Tax Payments" }

export default async function VatTaxPage() {
  const { payments, projects, bankAccounts, paymentMethods, error } =
    await getVatTaxPayments()

  return (
    <VatTaxTable
      payments={payments}
      projects={projects}
      bankAccounts={bankAccounts}
      paymentMethods={paymentMethods}
      error={error}
    />
  )
}
