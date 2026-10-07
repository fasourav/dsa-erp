import { IncomeTable } from "@/app/(app)/income/income-table"
import { getIncome } from "@/lib/income-data"

export const metadata = { title: "Income" }

export default async function IncomePage() {
  const page = await getIncome()

  return <IncomeTable rows={page.rows} error={page.error} />
}
