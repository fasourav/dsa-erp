import { ReceivableTable } from "@/app/(app)/accounts/receivable/receivable-table"
import { getAccountsReceivable } from "@/lib/accounts-receivable-data"

export const metadata = { title: "Accounts receivable" }

export default async function AccountsReceivablePage() {
  const page = await getAccountsReceivable()

  return (
    <ReceivableTable rows={page.rows} aging={page.aging} error={page.error} />
  )
}
