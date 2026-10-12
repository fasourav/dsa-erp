import { PayableTable } from "@/app/(app)/accounts/payable/payable-table"
import { getAccountsPayable } from "@/lib/accounts-payable-data"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Accounts Payable" }

export default async function AccountsPayablePage() {
  await requireModule("accounts_payable")
  const page = await getAccountsPayable()

  return <PayableTable rows={page.rows} error={page.error} />
}
