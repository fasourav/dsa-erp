import { PayrollRunsTable } from "@/app/(app)/hr/payroll/payroll-runs-table"
import { listBankAccounts, listPaymentMethodNames } from "@/lib/bank-accounts"
import { getPayrollRuns } from "@/lib/payroll"

export const metadata = { title: "Payroll" }

export default async function PayrollPage() {
  const [{ runs, error }, bankAccounts, paymentMethods] = await Promise.all([
    getPayrollRuns(),
    listBankAccounts().catch(() => []),
    listPaymentMethodNames().catch(() => []),
  ])

  return (
    <PayrollRunsTable
      runs={runs}
      bankAccounts={bankAccounts}
      paymentMethods={paymentMethods}
      error={error}
    />
  )
}
