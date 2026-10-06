import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
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
    const rows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("assets")
          .select(
            "id, purchase_date, name, category, quantity, unit_cost, total_cost, lifespan_years, notes",
          )
          .order("purchase_date", { ascending: false })
          .order("name", { ascending: true })
          .range(from, to),
      "Asset list is larger than expected.",
    )

    const seen = new Set<string>()
    const categories: string[] = []
    const assets: AssetRow[] = rows.map((row) => {
      const category = row.category?.trim() ?? ""
      if (category && !seen.has(category)) {
        seen.add(category)
        categories.push(category)
      }

      const quantity = toNumber(row.quantity)
      const unitCost = toNumber(row.unit_cost)
      const totalCost =
        row.total_cost == null ? quantity * unitCost : toNumber(row.total_cost)
      const lifespanYears = toNumber(row.lifespan_years)
      const valued = assetValue(row.purchase_date ?? "", totalCost, lifespanYears)

      return {
        id: row.id,
        purchaseDate: row.purchase_date ?? "",
        name: row.name ?? "",
        category,
        quantity,
        unitCost,
        totalCost,
        lifespanYears,
        notes: row.notes ?? "",
        currentValue: valued.currentValue,
        monthlyDepreciation: valued.monthlyDepreciation,
      }
    })

    categories.sort((left, right) =>
      left.localeCompare(right, "en", { sensitivity: "base" }),
    )

    return { assets, categories, error: null }
  } catch {
    return { assets: [], categories: [], error: "Could not load assets." }
  }
}

function assetValue(
  purchaseDate: string,
  totalCost: number,
  lifespanYears: number,
): { currentValue: number; monthlyDepreciation: number } {
  const lifespanMonths = lifespanYears * 12
  if (lifespanMonths <= 0) {
    return { currentValue: roundMoney(Math.max(0, totalCost)), monthlyDepreciation: 0 }
  }

  const used = Math.min(
    lifespanMonths,
    Math.max(0, monthsSince(purchaseDate)),
  )
  const rate = totalCost / lifespanMonths

  return {
    monthlyDepreciation: roundMoney(rate),
    currentValue: roundMoney(Math.max(0, totalCost - used * rate)),
  }
}

function monthsSince(purchaseDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(purchaseDate)
  if (!match) return 0

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const now = new Date()
  let years = now.getFullYear() - year
  let months = now.getMonth() + 1 - month
  let days = now.getDate() - day

  if (days < 0) {
    months -= 1
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  }

  if (months < 0) {
    years -= 1
    months += 12
  }

  if (years < 0) return 0
  return years * 12 + months + days / 30
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}
