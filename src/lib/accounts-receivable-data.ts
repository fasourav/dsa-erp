import type { ReceivableRow } from "@/lib/accounts-receivable"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { isPaymentStatus } from "@/lib/payment-status"
import { dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export async function getAccountsReceivable(): Promise<{
  rows: ReceivableRow[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const invoiceRows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("accounts_receivable")
          .select(
            "id, client_name, project_id, project_name, due_date, billed_amount, paid, due, current_status",
          )
          .order("id", { ascending: true })
          .range(from, to),
      "Accounts receivable list is larger than expected.",
    )

    const rows = invoiceRows.flatMap((row) => {
      if (!row.id) {
        return []
      }

      return [
        {
          id: row.id,
          clientName: row.client_name?.trim() ?? "",
          projectId: row.project_id ?? "",
          projectName: row.project_name?.trim() ?? "",
          dueDate: row.due_date ? dateInputValue(row.due_date) : "",
          billedAmount: toNumber(row.billed_amount),
          paid: toNumber(row.paid),
          due: toNumber(row.due),
          status:
            row.current_status && isPaymentStatus(row.current_status)
              ? row.current_status
              : null,
        } satisfies ReceivableRow,
      ]
    })

    return { rows, error: null }
  } catch {
    return { rows: [], error: "Could not load accounts receivable." }
  }
}
