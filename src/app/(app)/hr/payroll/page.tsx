import { PayrollTable } from "@/app/(app)/hr/payroll/payroll-table"
import { listBankAccounts, listPaymentMethodNames } from "@/lib/bank-accounts"
import { getPayrollPageData } from "@/lib/payroll"

export const metadata = { title: "Payroll" }

export default async function PayrollPage() {
  const [{ salaries, employees, error }, bankAccounts, paymentMethods] =
    await Promise.all([
      getPayrollPageData(),
      listBankAccounts().catch(() => []),
      listPaymentMethodNames().catch(() => []),
    ])

  return (
    <PayrollTable
      salaries={salaries}
      employees={employees}
      bankAccounts={bankAccounts}
      paymentMethods={paymentMethods}
      error={error}
    />
  )
}
