import { ClientInvoicesTable } from "@/app/(app)/accounts/invoices/client-invoices-table"
import { getClientInvoices } from "@/lib/client-invoices"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Client Invoices" }

export default async function ClientInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>
}) {
  await requireModule("client_invoices")
  const params = await searchParams
  const projectParam = Array.isArray(params.project)
    ? params.project[0]
    : params.project
  const page = await getClientInvoices(projectParam ?? null)

  return (
    <ClientInvoicesTable
      key={page.projectFilter?.id ?? "all"}
      invoices={page.invoices}
      projects={page.projects}
      paymentMethods={page.paymentMethods}
      bankAccounts={page.bankAccounts}
      projectFilter={page.projectFilter}
      error={page.error}
    />
  )
}
