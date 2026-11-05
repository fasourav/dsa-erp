import { ExpensesTable } from "@/app/(app)/accounts/expenses/expenses-table"
import { ListPager } from "@/components/list-pager"
import {
  defaultExpenseSort,
  sortableExpenseColumns,
  type ExpenseColumnId,
} from "@/lib/operational-expenses"
import { getOperationalExpenses } from "@/lib/operational-expenses-data"
import {
  parsePageParams,
  parseSortParams,
  sortQueryParams,
} from "@/lib/page-query"
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
  const sort = parseSortParams<ExpenseColumnId>(
    params,
    sortableExpenseColumns,
    defaultExpenseSort,
  )
  const sortParams = sortQueryParams(sort, defaultExpenseSort)
  const data = await getOperationalExpenses({ q, page: requestedPage, sort })

  return (
    <div className="flex flex-col gap-3.5">
      <ExpensesTable
        expenses={data.expenses}
        poExpenses={data.poExpenses}
        categories={data.categories}
        departments={data.departments}
        paymentMethods={data.paymentMethods}
        bankAccounts={data.bankAccounts}
        total={data.total}
        page={data.page}
        error={data.error}
        initialQuery={q}
        sort={sort}
        pager={
          <ListPager
            basePath="/accounts/expenses"
            page={data.page}
            pageCount={data.pageCount}
            params={{
              q,
              sort: sortParams.sort,
              dir: sortParams.dir,
            }}
            label="Operational Expenses pages"
          />
        }
      />
    </div>
  )
}
