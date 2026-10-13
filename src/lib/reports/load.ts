import { launchFloor } from "@/lib/reports/period"
import { isMissingReportFunction, parseFinancialReport } from "@/lib/reports/parse"
import type { FinancialReport } from "@/lib/reports/types"
import { createClient } from "@/lib/supabase/server"

export type ReportLoad =
  | { status: "ok"; report: FinancialReport }
  | { status: "missing" }
  | { status: "denied" }
  | { status: "error" }

export async function reportLaunchDate(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("company_settings")
    .select("launch_date")
    .eq("id", true)
    .maybeSingle()
  return launchFloor(data?.launch_date)
}

export async function loadFinancialReport(from: string, to: string): Promise<ReportLoad> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("financial_report", {
    p_from: from,
    p_to: to,
  })

  if (error) {
    if (isMissingReportFunction(error)) return { status: "missing" }
    return { status: "error" }
  }

  const report = parseFinancialReport(data)
  if (!report) return { status: "denied" }
  return { status: "ok", report }
}
