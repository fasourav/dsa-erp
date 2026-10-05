import { PayableTable } from "@/app/(app)/accounts/payable/payable-table"
import { getAccountsPayable } from "@/lib/accounts-payable-data"

export const metadata = { title: "Accounts Payable" }

export default async function AccountsPayablePage() {
  const page = await getAccountsPayable()

  return <PayableTable rows={page.rows} error={page.error} />
}
