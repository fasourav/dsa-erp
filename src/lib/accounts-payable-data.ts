import type { PayableRow } from "@/lib/accounts-payable"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { openPayableForBill, paidByBillId } from "@/lib/open-payable"
import { getAccess } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

/**
 * Accounts payable is bill-based, matching the reports and dashboard: per purchase order,
 * Billed = non-void vendor bills, Paid = payments against those bills, Open = the sum of each
 * bill's unpaid balance (never below 0). Unbilled order value is a commitment, not a payable.
 */
export async function getAccountsPayable(): Promise<{
  rows: PayableRow[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const [access, orders, bills, payments] = await Promise.all([
      getAccess(),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("vendor_purchase_orders")
            .select("id, work_type, project_id, vendor_id, projects(name), vendors(person_name, company_name)")
            .order("id", { ascending: true })
            .range(from, to),
        "Accounts payable list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("vendor_invoices")
            .select("id, purchase_order_id, amount, status")
            .order("id", { ascending: true })
            .range(from, to),
        "Accounts payable list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("vendor_payments")
            .select("id, vendor_invoice_id, amount")
            .order("id", { ascending: true })
            .range(from, to),
        "Accounts payable list is larger than expected.",
      ),
    ])
    const seesMoney = !access || access.isOwner || access.showFinancials

    const paidByBill = paidByBillId(
      payments.map((payment) => ({
        billId: payment.vendor_invoice_id,
        amount: toNumber(payment.amount),
      })),
    )

    const totals = new Map<string, { billed: number; paid: number; open: number }>()
    for (const bill of bills) {
      if (!bill.purchase_order_id || bill.status === "void") continue
      const amount = toNumber(bill.amount)
      const paid = paidByBill.get(bill.id) ?? 0
      const entry = totals.get(bill.purchase_order_id) ?? { billed: 0, paid: 0, open: 0 }
      entry.billed += amount
      entry.paid += paid
      entry.open += openPayableForBill(amount, paid, bill.status)
      totals.set(bill.purchase_order_id, entry)
    }

    const rows = orders.flatMap((order) => {
      const entry = totals.get(order.id)
      if (!entry) return []
      const project = order.projects as { name: string | null } | null
      const vendor = order.vendors as { person_name: string | null; company_name: string | null } | null
      return [
        {
          id: order.id,
          vendorName: (vendor?.person_name || vendor?.company_name || "").trim(),
          workType: order.work_type?.trim() ?? "",
          projectId: order.project_id ?? "",
          projectName: order.project_id ? (project?.name?.trim() ?? "") : "Operational",
          purchaseOrderId: order.id,
          totalPayable: seesMoney ? entry.billed : 0,
          totalPaid: seesMoney ? entry.paid : 0,
          pendingPayable: seesMoney ? entry.open : 0,
        } satisfies PayableRow,
      ]
    })

    return { rows, error: null }
  } catch {
    return { rows: [], error: "Could not load accounts payable." }
  }
}
