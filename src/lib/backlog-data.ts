import type { BacklogRow } from "@/lib/backlog"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import type { ProjectStatus } from "@/lib/project-summary"
import { createClient } from "@/lib/supabase/server"

export async function getBacklog(): Promise<{
  rows: BacklogRow[]
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const projects = await fetchAllPages(
      (from, to) =>
        supabase
          .from("project_backlogs")
          .select(
            "project_id, project_name, project_value, total_paid, expense_total, backlog_amount, project_status, recovery_plan",
          )
          .order("project_id", { ascending: true })
          .range(from, to),
      "Backlog list is larger than expected.",
    )

    const rows = projects.flatMap((project) => {
      if (!project.project_id) {
        return []
      }

      return [
        {
          id: project.project_id,
          projectName: project.project_name?.trim() ?? "",
          projectValue: toNumber(project.project_value),
          amountPaid: toNumber(project.total_paid),
          totalExpense: toNumber(project.expense_total),
          backlogAmount: toNumber(project.backlog_amount),
          status: projectStatus(project.project_status),
          recoveryPlan: project.recovery_plan?.trim() ?? "",
        } satisfies BacklogRow,
      ]
    })

    return { rows, error: null }
  } catch {
    return { rows: [], error: "Could not load backlog." }
  }
}

function projectStatus(value: string | null): ProjectStatus | null {
  if (value === "active" || value === "completed") {
    return value
  }

  return null
}
