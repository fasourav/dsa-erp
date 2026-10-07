import { toNumber } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"
import {
  mergeCategorySuggestions,
  type VendorSummary,
} from "@/lib/vendor-summary"

export async function getVendors(): Promise<{
  vendors: VendorSummary[]
  categories: string[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const [summariesResult, detailsResult, categoriesResult] = await Promise.all([
      supabase
        .from("vendor_summaries")
        .select(
          "vendor_id, kind, display_name, vendor_field, total_po_value, total_paid, total_due",
        ),
      supabase
        .from("vendors")
        .select("id, person_name, company_name, email, phone, notes, address"),
      supabase
        .from("vendor_work_categories")
        .select("name, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ])

    if (summariesResult.error || detailsResult.error) {
      return { vendors: [], categories: [], error: "Could not load vendors." }
    }

    const details = new Map(
      (detailsResult.data ?? []).map((row) => [row.id, row]),
    )

    const vendors = (summariesResult.data ?? []).flatMap((row) => {
      if (!row.vendor_id) {
        return []
      }

      const detail = details.get(row.vendor_id)
      const vendorField = row.vendor_field?.trim() || null

      return [
        {
          id: row.vendor_id,
          displayName: row.display_name?.trim() ?? "",
          kind: row.kind,
          vendorField,
          personName: detail?.person_name ?? null,
          companyName: detail?.company_name ?? null,
          email: detail?.email ?? null,
          phone: detail?.phone ?? null,
          notes: detail?.notes ?? null,
          address: detail?.address ?? null,
          totalProjectValue: toNumber(row.total_po_value),
          totalPaid: toNumber(row.total_paid),
          totalDue: toNumber(row.total_due),
        } satisfies VendorSummary,
      ]
    })

    const catalogNames = categoriesResult.error
      ? []
      : (categoriesResult.data ?? []).map((row) => row.name)

    return {
      vendors,
      categories: mergeCategorySuggestions(
        catalogNames,
        vendors.map((vendor) => vendor.vendorField),
      ),
      error: null,
    }
  } catch {
    return { vendors: [], categories: [], error: "Could not load vendors." }
  }
}
