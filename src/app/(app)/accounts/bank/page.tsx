import { BankPanel } from "@/app/(app)/accounts/bank/bank-panel"
import { getBankPage } from "@/lib/bank-data"
import { getReconciliation } from "@/lib/bank-reconcile-data"
import { getFiscalYearStartMonth } from "@/lib/company-settings"
import { dhakaToday } from "@/lib/dashboard-metrics"
import { isIsoDate } from "@/lib/project-validation"
import { requireModule } from "@/lib/permissions"
import { firstParam } from "@/lib/search"

export const metadata = { title: "Bank" }

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{
    account?: string | string[]
    view?: string | string[]
    q?: string | string[]
    from?: string | string[]
    to?: string | string[]
  }>
}) {
  await requireModule("banking")
  const params = await searchParams
  const accountParam = Array.isArray(params.account)
    ? params.account[0]
    : params.account
  const viewParam = Array.isArray(params.view) ? params.view[0] : params.view
  const view = viewParam === "statement" ? "statement" : viewParam === "reconcile" ? "reconcile" : "ledger"
  const initialQuery = firstParam(params.q)
  const period = reconcileWindow(firstParam(params.from), firstParam(params.to))
  const [page, fiscalYearStartMonth, reconciliation] = await Promise.all([
    getBankPage(accountParam ?? null),
    getFiscalYearStartMonth(),
    view === "reconcile" ? getReconciliation(accountParam ?? null) : Promise.resolve(null),
  ])

  return (
    <BankPanel
      key={`${view === "reconcile" ? "reconcile" : (page.accountFilter?.id ?? "all")}-${view}-${initialQuery}-${period.from}-${period.to}`}
      accounts={page.accounts}
      transactions={page.transactions}
      paymentMethods={page.paymentMethods}
      accountFilter={page.accountFilter}
      error={page.error}
      fiscalYearStartMonth={fiscalYearStartMonth}
      view={view}
      initialQuery={initialQuery}
      reconciliation={reconciliation}
      periodFrom={period.from}
      periodTo={period.to}
    />
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
