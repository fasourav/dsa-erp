import { createClient } from "@/lib/supabase/server"

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
