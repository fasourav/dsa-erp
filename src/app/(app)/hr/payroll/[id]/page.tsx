import { notFound } from "next/navigation"

import { PayrollDetailPanel } from "@/app/(app)/hr/payroll/[id]/payroll-detail-panel"
import { listBankAccounts, listPaymentMethodNames } from "@/lib/bank-accounts"
import { isUuid } from "@/lib/ids"
import { getMonthlySalary } from "@/lib/payroll"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Monthly Salary" }

export default async function MonthlySalaryPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireModule("payroll")
  const { id } = await params
  if (!isUuid(id)) notFound()

  const [{ salary, employees }, bankAccounts, paymentMethods] = await Promise.all([
    getMonthlySalary(id),
    listBankAccounts().catch(() => []),
    listPaymentMethodNames().catch(() => []),
  ])

  if (!salary) notFound()

  return (
    <PayrollDetailPanel
      salary={salary}
      employees={employees}
      bankAccounts={bankAccounts}
      paymentMethods={paymentMethods}
    />
  )
}
