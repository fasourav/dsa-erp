import { notFound } from "next/navigation"

import { PayrollDetailPanel } from "@/app/(app)/hr/payroll/[id]/payroll-detail-panel"
import { isUuid } from "@/lib/ids"
import { getPayrollRunDetail } from "@/lib/payroll"

export const metadata = { title: "Payroll Run" }

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const { run, lines, employees } = await getPayrollRunDetail(id)
  if (!run) notFound()

  return (
    <PayrollDetailPanel run={run} lines={lines} employees={employees} />
  )
}
