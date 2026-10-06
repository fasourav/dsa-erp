import { PayrollRunsTable } from "@/app/(app)/hr/payroll/payroll-runs-table"
import { getPayrollRuns } from "@/lib/payroll"

export const metadata = { title: "Payroll" }

export default async function PayrollPage() {
  const { runs, error } = await getPayrollRuns()

  return <PayrollRunsTable runs={runs} error={error} />
}
