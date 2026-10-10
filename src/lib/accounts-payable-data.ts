import type { PayableRow } from "@/lib/accounts-payable"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export async function getAccountsPayable(): Promise<{
  rows: PayableRow[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const invoiceRows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("accounts_payable")
          .select(
            "id, vendor_name, work_type, project_id, project_name, purchase_order_id, total_payable, total_paid, pending_payable",
          )
          .order("id", { ascending: true })
          .range(from, to),
      "Accounts payable list is larger than expected.",
    )

    const rows = invoiceRows.flatMap((row) => {
      if (!row.id) {
        return []
      }

      return [
        {
          id: row.id,
          vendorName: row.vendor_name?.trim() ?? "",
          workType: row.work_type?.trim() ?? "",
          projectId: row.project_id ?? "",
          projectName: row.project_name?.trim() ?? "",
          purchaseOrderId: row.purchase_order_id ?? "",
          totalPayable: toNumber(row.total_payable),
          totalPaid: toNumber(row.total_paid),
          pendingPayable: toNumber(row.pending_payable),
        } satisfies PayableRow,
      ]
    })

    return { rows, error: null }
  } catch {
    return { rows: [], error: "Could not load accounts payable." }
  }
}
