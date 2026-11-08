import { ReceivableTable } from "@/app/(app)/accounts/receivable/receivable-table"
import {
  receivableColumns,
  type ReceivableColumnId,
} from "@/lib/accounts-receivable"
import { getAccountsReceivable } from "@/lib/accounts-receivable-data"
import { parsePageParams, parseSortParams } from "@/lib/page-query"
import { requireModule } from "@/lib/permissions"
import { parseSettlementFilter } from "@/lib/settlement-filter"

export const metadata = { title: "Accounts Receivable" }

const defaultSort = {
  key: "projectName",
  direction: "asc",
} as const

export default async function AccountsReceivablePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireModule("accounts_receivable")
  const params = await searchParams
  const { page, q } = parsePageParams(params)
  const data = await getAccountsReceivable()

  return (
    <ReceivableTable
      rows={data.rows}
      error={data.error}
      initialQuery={q}
      page={page}
      statusFilter={parseSettlementFilter(params.status)}
      sort={parseSortParams<ReceivableColumnId>(
        params,
        receivableColumns.map((column) => column.id),
        defaultSort,
      )}
    />
  )
}
