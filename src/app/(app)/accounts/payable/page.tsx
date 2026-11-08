import { PayableTable } from "@/app/(app)/accounts/payable/payable-table"
import {
  payableColumns,
  type PayableColumnId,
} from "@/lib/accounts-payable"
import { getAccountsPayable } from "@/lib/accounts-payable-data"
import { parsePageParams, parseSortParams } from "@/lib/page-query"
import { requireModule } from "@/lib/permissions"
import { parseSettlementFilter } from "@/lib/settlement-filter"

export const metadata = { title: "Accounts Payable" }

const defaultSort = {
  key: "vendorName",
  direction: "asc",
} as const

export default async function AccountsPayablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireModule("accounts_payable")
  const params = await searchParams
  const { page, q } = parsePageParams(params)
  const data = await getAccountsPayable()

  return (
    <PayableTable
      rows={data.rows}
      error={data.error}
      initialQuery={q}
      page={page}
      statusFilter={parseSettlementFilter(params.status)}
      sort={parseSortParams<PayableColumnId>(
        params,
        payableColumns.map((column) => column.id),
        defaultSort,
      )}
    />
  )
}
