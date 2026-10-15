import { toNumber } from "@/lib/format"
import {
  isStageStatus,
  type ProjectMilestone,
  type ProjectProgressData,
  type ProjectStage,
  type StageTemplate,
} from "@/lib/project-progress"
import { businessTodayIsoDate, dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export async function getStageTemplates(): Promise<{
  templates: StageTemplate[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_stage_templates")
    .select("id, sort_order, name, weight")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error || !data) {
    return { templates: [], error: "Could not load the stage template." }
  }

  return {
    templates: data.map(toTemplate),
    error: null,
  }
}

export async function getProjectProgress(projectId: string): Promise<{
  progress: ProjectProgressData | null
  error: string | null
}> {
  const supabase = await createClient()
  const [project, stages, milestones, templates] = await Promise.all([
    supabase.from("projects").select("progress_percent").eq("id", projectId).maybeSingle(),
    supabase
      .from("project_stages")
      .select(
        "id, sort_order, name, weight, status, planned_start, planned_end, done_on, notes",
      )
      .eq("project_id", projectId)
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
    supabase
      .from("project_stage_templates")
      .select("id, sort_order, name, weight")
      .order("sort_order", { ascending: true }),
  ])

  if (project.error || stages.error || milestones.error || templates.error || !project.data) {
    return { progress: null, error: "Could not load project progress." }
  }

  return {
    progress: {
      progressPercent: toNumber(project.data.progress_percent),
      stages: (stages.data ?? []).map(toStage),
      milestones: (milestones.data ?? []).map(toMilestone),
      templates: (templates.data ?? []).map(toTemplate),
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

function toTemplate(row: {
  id: string
  sort_order: number
  name: string
  weight: number
}): StageTemplate {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    name: row.name.trim(),
    weight: toNumber(row.weight),
  }
}

function toStage(row: {
  id: string
  sort_order: number
  name: string
  weight: number
  status: string
  planned_start: string | null
  planned_end: string | null
  done_on: string | null
  notes: string
}): ProjectStage {
  return {
    id: row.id,
    sortOrder: row.sort_order,
    name: row.name.trim(),
    weight: toNumber(row.weight),
    status: isStageStatus(row.status) ? row.status : "Not Started",
    plannedStart: dateInputValue(row.planned_start ?? ""),
    plannedEnd: dateInputValue(row.planned_end ?? ""),
    doneOn: dateInputValue(row.done_on ?? ""),
    notes: row.notes ?? "",
  }
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
