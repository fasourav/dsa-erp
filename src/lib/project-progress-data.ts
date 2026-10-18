import { toNumber } from "@/lib/format"
import {
  phaseProgressSummary,
  type ProjectMilestone,
  type ProjectProgressData,
} from "@/lib/project-progress"
import { businessTodayIsoDate, dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export async function getProjectProgress(projectId: string): Promise<{
  progress: ProjectProgressData | null
  error: string | null
}> {
  const supabase = await createClient()
  const [project, phases, milestones] = await Promise.all([
    supabase
      .from("projects")
      .select("current_phase, progress_percent")
      .eq("id", projectId)
      .maybeSingle(),
    supabase
      .from("project_phases")
      .select("id, name, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    supabase
      .from("project_milestones")
      .select(
        "id, stage_id, work_order_milestone_id, label, due_on, done_on, percent_of_value, amount",
      )
      .eq("project_id", projectId)
      .order("due_on", { ascending: true, nullsFirst: false })
      .order("label", { ascending: true }),
  ])

  if (project.error || phases.error || milestones.error || !project.data) {
    return { progress: null, error: "Could not load project progress." }
  }

  const summary = phaseProgressSummary(project.data.current_phase, phases.data ?? [])

  return {
    progress: {
      progressPercent: summary.progressPercent,
      currentPhase: summary.currentPhase,
      phaseSerial: summary.phaseSerial,
      totalPhases: summary.totalPhases,
      milestones: (milestones.data ?? []).map(toMilestone),
    },
    error: null,
  }
}

export async function overdueCountsByProject(): Promise<Map<string, number>> {
  const supabase = await createClient()
  const today = businessTodayIsoDate()
  const { data, error } = await supabase
    .from("project_milestones")
    .select("project_id, due_on, done_on")
    .is("done_on", null)
    .not("due_on", "is", null)

  const counts = new Map<string, number>()
  if (error || !data) return counts

  for (const row of data) {
    const dueOn = dateInputValue(row.due_on ?? "")
    if (!dueOn || dueOn >= today) continue
    counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1)
  }

  return counts
}

function toMilestone(row: {
  id: string
  stage_id: string | null
  work_order_milestone_id: string | null
  label: string
  due_on: string | null
  done_on: string | null
  percent_of_value: number | null
  amount: number | null
}): ProjectMilestone {
  return {
    id: row.id,
    stageId: row.stage_id ?? "",
    workOrderMilestoneId: row.work_order_milestone_id,
    label: row.label.trim(),
    dueOn: dateInputValue(row.due_on ?? ""),
    doneOn: dateInputValue(row.done_on ?? ""),
    percentOfValue: row.percent_of_value === null ? null : toNumber(row.percent_of_value),
    amount: row.amount === null ? null : toNumber(row.amount),
  }
}
