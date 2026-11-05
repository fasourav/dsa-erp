import { ExpensesTable } from "@/app/(app)/accounts/expenses/expenses-table"
import { ListPager } from "@/components/list-pager"
import { getOperationalExpenses } from "@/lib/operational-expenses-data"
import { parsePageParams } from "@/lib/page-query"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Operational Expenses" }

export default async function OperationalExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireModule("expenses")
  const params = await searchParams
  const { page: requestedPage, q } = parsePageParams(params)
  const data = await getOperationalExpenses({ q, page: requestedPage })

  return (
    <div className="flex flex-col gap-3.5">
      <ExpensesTable
        expenses={data.expenses}
        categories={data.categories}
        departments={data.departments}
        paymentMethods={data.paymentMethods}
        bankAccounts={data.bankAccounts}
        total={data.total}
        page={data.page}
        pageCount={data.pageCount}
        error={data.error}
        initialQuery={q}
      />
      <ListPager
        basePath="/accounts/expenses"
        page={data.page}
        pageCount={data.pageCount}
        params={{ q }}
        label="Operational Expenses pages"
      />
    </div>
  )
}
