import { BankPanel } from "@/app/(app)/accounts/bank/bank-panel"
import { getBankPage } from "@/lib/bank-data"
import { getFiscalYearStartMonth } from "@/lib/company-settings"

export const metadata = { title: "Bank" }

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string | string[]; view?: string | string[] }>
}) {
  const params = await searchParams
  const accountParam = Array.isArray(params.account)
    ? params.account[0]
    : params.account
  const viewParam = Array.isArray(params.view) ? params.view[0] : params.view
  const [page, fiscalYearStartMonth] = await Promise.all([
    getBankPage(accountParam ?? null),
    getFiscalYearStartMonth(),
  ])

  return (
    <BankPanel
      key={`${page.accountFilter?.id ?? "all"}-${viewParam === "statement" ? "statement" : "ledger"}`}
      accounts={page.accounts}
      transactions={page.transactions}
      paymentMethods={page.paymentMethods}
      accountFilter={page.accountFilter}
      error={page.error}
      fiscalYearStartMonth={fiscalYearStartMonth}
      view={viewParam === "statement" ? "statement" : "ledger"}
    />
  )
}
