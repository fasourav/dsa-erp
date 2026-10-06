import { fetchAllPages } from "@/lib/fetch-pages"
import { createClient } from "@/lib/supabase/server"

export type AssetRow = {
  id: string
  purchaseDate: string
  name: string
  category: string
  quantity: number
  unitCost: number
  totalCost: number
  lifespanYears: number
  notes: string
  currentValue: number
  monthlyDepreciation: number
}

export async function getAssets(): Promise<{
  assets: AssetRow[]
  categories: string[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const [rows, catRows] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("asset_register")
            .select("*")
            .order("purchase_date", { ascending: false })
            .range(from, to),
        "Asset list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("assets")
            .select("category")
            .order("category", { ascending: true })
            .range(from, to),
        "Asset category list is larger than expected.",
      ),
    ])

    const assets: AssetRow[] = rows.map((r) => ({
      id: r.asset_id ?? "",
      purchaseDate: r.purchase_date ?? "",
      name: r.name ?? "",
      category: r.category ?? "",
      quantity: r.quantity ?? 0,
      unitCost: r.unit_cost ?? 0,
      totalCost: r.total_cost ?? 0,
      lifespanYears: r.lifespan_years ?? 0,
      notes: r.notes ?? "",
      currentValue: r.current_value ?? 0,
      monthlyDepreciation: r.monthly_depreciation ?? 0,
    }))

    const seen = new Set<string>()
    const categories: string[] = []
    for (const row of catRows) {
      const name = (row.category ?? "").trim()
      if (name && !seen.has(name)) {
        seen.add(name)
        categories.push(name)
      }
    }

    return { assets, categories, error: null }
  } catch {
    return { assets: [], categories: [], error: "Could not load assets." }
  }
}
