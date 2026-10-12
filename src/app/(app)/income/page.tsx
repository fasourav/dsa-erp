import { IncomeTable } from "@/app/(app)/income/income-table"
import { getIncome } from "@/lib/income-data"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Income" }

export default async function IncomePage() {
  await requireModule("income")
  const page = await getIncome()

  return <IncomeTable rows={page.rows} error={page.error} />
}
