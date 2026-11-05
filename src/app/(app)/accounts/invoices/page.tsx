import { ClientInvoicesTable } from "@/app/(app)/accounts/invoices/client-invoices-table"
import { ListPager } from "@/components/list-pager"
import {
  getClientInvoices,
  parseInvoiceStatusFilter,
} from "@/lib/client-invoices"
import { parsePageParams } from "@/lib/page-query"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Client Invoices" }

export default async function ClientInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireModule("client_invoices")
  const params = await searchParams
  const projectParam = Array.isArray(params.project)
    ? params.project[0]
    : params.project
  const status = parseInvoiceStatusFilter(params.status)
  const { page: requestedPage, q } = parsePageParams(params)
  const data = await getClientInvoices(projectParam ?? null, {
    q,
    page: requestedPage,
    status,
  })

  return (
    <div className="flex flex-col gap-3.5">
      <ClientInvoicesTable
        key={data.projectFilter?.id ?? "all"}
        invoices={data.invoices}
        projects={data.projects}
        paymentMethods={data.paymentMethods}
        bankAccounts={data.bankAccounts}
        projectFilter={data.projectFilter}
        total={data.total}
        page={data.page}
        pageCount={data.pageCount}
        error={data.error}
        initialQuery={q}
        statusFilter={status}
      />
      <ListPager
        basePath="/accounts/invoices"
        page={data.page}
        pageCount={data.pageCount}
        params={{
          project: data.projectFilter?.id,
          q,
          status: status === "all" ? undefined : status,
        }}
        label="Client Invoices pages"
      />
    </div>
  )
}
