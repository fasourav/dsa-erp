import { VatTaxTable } from "@/app/(app)/accounts/vat-tax/vat-tax-table"
import { getVatTaxPayments } from "@/lib/vat-tax"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "VAT / Tax Payments" }

export default async function VatTaxPage() {
  await requireModule("vat_tax")
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
