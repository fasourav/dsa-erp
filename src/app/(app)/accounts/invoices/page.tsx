import { ClientInvoicesTable } from "@/app/(app)/accounts/invoices/client-invoices-table"
import { getClientInvoices } from "@/lib/client-invoices"
import { requireModule } from "@/lib/permissions"
import { firstParam } from "@/lib/search"

export const metadata = { title: "Client Invoices" }

export default async function ClientInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[]; q?: string | string[] }>
}) {
  await requireModule("client_invoices")
  const params = await searchParams
  const projectParam = Array.isArray(params.project)
    ? params.project[0]
    : params.project
  const page = await getClientInvoices(projectParam ?? null)
  const initialQuery = firstParam(params.q)

  return (
    <ClientInvoicesTable
      key={`${page.projectFilter?.id ?? "all"}-${initialQuery}`}
      invoices={page.invoices}
      projects={page.projects}
      paymentMethods={page.paymentMethods}
      bankAccounts={page.bankAccounts}
      projectFilter={page.projectFilter}
      error={page.error}
      initialQuery={initialQuery}
    />
  )
}
