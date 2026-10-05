import { sortAgingSummaries, type AgingSummaryRow } from "@/lib/aging"
import type { PayableRow } from "@/lib/accounts-payable"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { isPaymentStatus } from "@/lib/payment-status"
import { dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export async function getAccountsPayable(): Promise<{
  rows: PayableRow[]
  aging: AgingSummaryRow[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const [invoiceRows, summaryResult] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("accounts_payable_aging")
            .select(
              "id, vendor_name, project_id, project_name, purchase_order_id, issued_on, due_date, total_payable, total_paid, pending_payable, current_status, aging_bucket, days_past_due",
            )
            .order("id", { ascending: true })
            .range(from, to),
        "Accounts payable list is larger than expected.",
      ),
      supabase
        .from("ap_aging_summary")
        .select("aging_bucket, amount_pending, invoice_count"),
    ])

    if (summaryResult.error) {
      return { rows: [], aging: [], error: "Could not load accounts payable." }
    }

    const rows = invoiceRows.flatMap((row) => {
      if (!row.id) {
        return []
      }

      return [
        {
          id: row.id,
          vendorName: row.vendor_name?.trim() ?? "",
          projectId: row.project_id ?? "",
          projectName: row.project_name?.trim() ?? "",
          purchaseOrderId: row.purchase_order_id ?? "",
          issuedOn: row.issued_on ? dateInputValue(row.issued_on) : "",
          dueDate: row.due_date ? dateInputValue(row.due_date) : "",
          totalPayable: toNumber(row.total_payable),
          totalPaid: toNumber(row.total_paid),
          pendingPayable: toNumber(row.pending_payable),
          status:
            row.current_status && isPaymentStatus(row.current_status)
              ? row.current_status
              : null,
          agingBucket: row.aging_bucket?.trim() ?? "",
          daysPastDue:
            row.days_past_due === null || row.days_past_due === undefined
              ? null
              : toNumber(row.days_past_due),
        } satisfies PayableRow,
      ]
    })

    const aging = sortAgingSummaries(
      (summaryResult.data ?? []).flatMap((row) => {
        const bucket = row.aging_bucket?.trim() ?? ""
        if (!bucket) {
          return []
        }

        return [
          {
            bucket,
            amount: toNumber(row.amount_pending),
            count: toNumber(row.invoice_count),
          },
        ]
      }),
    )

    return { rows, aging, error: null }
  } catch {
    return { rows: [], aging: [], error: "Could not load accounts payable." }
  }
}
