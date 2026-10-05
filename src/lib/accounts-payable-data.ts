import type { PayableRow } from "@/lib/accounts-payable"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export async function getAccountsPayable(): Promise<{
  rows: PayableRow[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const [invoiceRows, vendorRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("accounts_payable")
            .select(
              "id, vendor_id, vendor_name, project_id, project_name, purchase_order_id, due_date, total_payable, total_paid, pending_payable",
            )
            .order("id", { ascending: true })
            .range(from, to),
        "Accounts payable list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("vendors")
            .select("id, vendor_field")
            .order("id", { ascending: true })
            .range(from, to),
        "Vendor list is larger than expected.",
      ),
    ])

    const vendorFields = new Map(
      vendorRows.map((vendor) => [vendor.id, vendor.vendor_field?.trim() ?? ""]),
    )

    const rows = invoiceRows.flatMap((row) => {
      if (!row.id) {
        return []
      }

      return [
        {
          id: row.id,
          vendorName: row.vendor_name?.trim() ?? "",
          vendorField: row.vendor_id ? vendorFields.get(row.vendor_id) ?? "" : "",
          projectId: row.project_id ?? "",
          projectName: row.project_name?.trim() ?? "",
          purchaseOrderId: row.purchase_order_id ?? "",
          dueDate: row.due_date ? dateInputValue(row.due_date) : "",
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
