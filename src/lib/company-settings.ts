import {
  clampPrintMargin,
  DEFAULT_PRINT_MARGIN_BOTTOM_MM,
  DEFAULT_PRINT_MARGIN_TOP_MM,
  type PrintMargins,
} from "@/lib/documents/drafts"
import { DEFAULT_LAUNCH_DATE, normalizeLaunchDate } from "@/lib/format"
import { createClient } from "@/lib/supabase/server"

export async function getLaunchDate(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("company_settings")
    .select("launch_date")
    .eq("id", true)
    .limit(1)

  if (error || !data?.[0]) {
    return DEFAULT_LAUNCH_DATE
  }

  return normalizeLaunchDate(data[0].launch_date)
}

export async function getFiscalYearStartMonth(): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("company_settings")
    .select("fiscal_year_start_month")
    .eq("id", true)
    .limit(1)

  if (error || !data?.[0]) {
    return 7
  }

  const month = data[0].fiscal_year_start_month
  return month >= 1 && month <= 12 ? month : 7
}

export async function getPrintMargins(): Promise<PrintMargins> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("company_settings")
    .select("print_margin_top_mm, print_margin_bottom_mm")
    .eq("id", true)
    .limit(1)

  if (error || !data?.[0]) {
    return {
      topMm: DEFAULT_PRINT_MARGIN_TOP_MM,
      bottomMm: DEFAULT_PRINT_MARGIN_BOTTOM_MM,
    }
  }

  return {
    topMm: clampPrintMargin(data[0].print_margin_top_mm, DEFAULT_PRINT_MARGIN_TOP_MM),
    bottomMm: clampPrintMargin(
      data[0].print_margin_bottom_mm,
      DEFAULT_PRINT_MARGIN_BOTTOM_MM,
    ),
  }
}
