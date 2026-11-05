import { BankPanel } from "@/app/(app)/accounts/bank/bank-panel"
import { ListPager } from "@/components/list-pager"
import {
  defaultBankTransactionSort,
  sortableBankTransactionColumns,
  type BankTransactionColumnId,
} from "@/lib/bank"
import { getBankPage } from "@/lib/bank-data"
import { getReconciliation } from "@/lib/bank-reconcile-data"
import { getFiscalYearStartMonth } from "@/lib/company-settings"
import { dhakaToday } from "@/lib/dashboard-metrics"
import {
  parsePageParams,
  parseSortParams,
  sortQueryParams,
} from "@/lib/page-query"
import { isIsoDate } from "@/lib/project-validation"
import { requireModule } from "@/lib/permissions"
import { firstParam } from "@/lib/search"

export const metadata = { title: "Bank" }

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireModule("banking")
  const params = await searchParams
  const accountParam = Array.isArray(params.account)
    ? params.account[0]
    : params.account
  const viewParam = Array.isArray(params.view) ? params.view[0] : params.view
  const view =
    viewParam === "statement"
      ? "statement"
      : viewParam === "reconcile"
        ? "reconcile"
        : "ledger"
  const { page: requestedPage, q } = parsePageParams(params)
  const sort = parseSortParams<BankTransactionColumnId>(
    params,
    sortableBankTransactionColumns,
    defaultBankTransactionSort,
  )
  const sortParams = sortQueryParams(sort, defaultBankTransactionSort)
  const period = reconcileWindow(firstParam(params.from), firstParam(params.to))
  const [data, fiscalYearStartMonth, reconciliation] = await Promise.all([
    getBankPage(accountParam ?? null, {
      q,
      page: requestedPage,
      sort,
      includeReportRows: view !== "ledger",
    }),
    getFiscalYearStartMonth(),
    view === "reconcile"
      ? getReconciliation(accountParam ?? null)
      : Promise.resolve(null),
  ])

  return (
    <div className="flex flex-col gap-3.5">
      <BankPanel
        key={`${view === "reconcile" ? "reconcile" : (data.accountFilter?.id ?? "all")}-${view}-${period.from}-${period.to}`}
        accounts={data.accounts}
        accountBalances={data.accountBalances}
        transactions={data.transactions}
        reportTransactions={data.reportTransactions}
        paymentMethods={data.paymentMethods}
        accountFilter={data.accountFilter}
        total={data.total}
        page={data.page}
        error={data.error}
        fiscalYearStartMonth={fiscalYearStartMonth}
        view={view}
        initialQuery={q}
        sort={sort}
        reconciliation={reconciliation}
        periodFrom={period.from}
        periodTo={period.to}
      />
      {view === "ledger" ? (
        <ListPager
          basePath="/accounts/bank"
          page={data.page}
          pageCount={data.pageCount}
          params={{
            account: data.accountFilter?.id,
            q,
            sort: sortParams.sort,
            dir: sortParams.dir,
          }}
          label="Bank transactions pages"
        />
      ) : null}
    </div>
  )
}

function reconcileWindow(from: string, to: string) {
  const today = dhakaToday(new Date())
  const monthStart = `${today.slice(0, 8)}01`
  const start = from && isIsoDate(from) ? from : monthStart
  const end = to && isIsoDate(to) ? to : today
  if (end < start) return { from: monthStart, to: today }
  return { from: start, to: end }
}
