import { ReceivableTable } from "@/app/(app)/accounts/receivable/receivable-table"
import { getAccountsReceivable } from "@/lib/accounts-receivable-data"

export const metadata = { title: "Accounts Receivable" }

export default async function AccountsReceivablePage() {
  const page = await getAccountsReceivable()

  return <ReceivableTable rows={page.rows} error={page.error} />
}
