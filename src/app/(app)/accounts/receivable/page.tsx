import { ReceivableTable } from "@/app/(app)/accounts/receivable/receivable-table"
import { getAccountsReceivable } from "@/lib/accounts-receivable-data"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Accounts Receivable" }

export default async function AccountsReceivablePage() {
  await requireModule("accounts_receivable")
  const page = await getAccountsReceivable()

  return <ReceivableTable rows={page.rows} error={page.error} />
}
