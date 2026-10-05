import { BankPanel } from "@/app/(app)/accounts/bank/bank-panel"
import { getBankPage } from "@/lib/bank-data"

export const metadata = { title: "Bank" }

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string | string[] }>
}) {
  const params = await searchParams
  const accountParam = Array.isArray(params.account)
    ? params.account[0]
    : params.account
  const page = await getBankPage(accountParam ?? null)

  return (
    <BankPanel
      key={page.accountFilter?.id ?? "all"}
      accounts={page.accounts}
      transactions={page.transactions}
      projects={page.projects}
      paymentMethods={page.paymentMethods}
      accountFilter={page.accountFilter}
      error={page.error}
    />
  )
}
