"use server"

import { revalidatePath } from "next/cache"

import { friendlyDbError } from "@/lib/db-errors"
import {
  parseAmount,
  parseWeight,
  projectMilestoneSchema,
  projectStageSchema,
  type ProjectMilestoneInput,
  type ProjectStageInput,
} from "@/lib/project-progress"
import { businessTodayIsoDate } from "@/lib/project-validation"
import type { PermissionAction } from "@/lib/access"
import { denyUnless } from "@/lib/permissions"
import { firstIssue } from "@/lib/schemas"
import { createClient } from "@/lib/supabase/server"

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ProgressFieldErrors = Record<string, string | undefined>

export type ProgressActionResult = {
  error: string | null
  fieldErrors?: ProgressFieldErrors
}

export async function saveProjectStage(
  projectId: string,
  stageId: string | null,
  input: ProjectStageInput,
): Promise<ProgressActionResult> {
  const denied = await denyUnlessStageWrite(stageId ? "edit" : "add")
  if (denied) return { error: denied }
  if (!idPattern.test(projectId) || (stageId && !idPattern.test(stageId))) {
    return { error: "That stage could not be found." }
  }

  const parsed = projectStageSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: null,
      fieldErrors: {
        name: firstIssue(parsed.error, "name"),
        weight: firstIssue(parsed.error, "weight"),
        status: firstIssue(parsed.error, "status"),
        plannedStart: firstIssue(parsed.error, "plannedStart"),
        plannedEnd: firstIssue(parsed.error, "plannedEnd"),
        doneOn: firstIssue(parsed.error, "doneOn"),
        notes: firstIssue(parsed.error, "notes"),
      },
    }
  }

  const weight = parseWeight(parsed.data.weight)
  if (weight === null) return { error: "Enter a weight from 0 to 100." }

  const doneOn =
    parsed.data.status === "Done" && !parsed.data.doneOn
      ? businessTodayIsoDate()
      : parsed.data.doneOn || null

  const supabase = await createClient()
  const row = {
    name: parsed.data.name,
    weight,
    status: parsed.data.status,
    planned_start: parsed.data.plannedStart || null,
    planned_end: parsed.data.plannedEnd || null,
    done_on: doneOn,
    notes: parsed.data.notes,
    updated_at: new Date().toISOString(),
  }

  if (stageId) {
    const { error } = await supabase
      .from("project_stages")
      .update(row)
      .eq("id", stageId)
      .eq("project_id", projectId)
    if (error) return { error: progressError(error) }
  } else {
    const sortOrder = await nextSortOrder(supabase, projectId)
    const { error } = await supabase.from("project_stages").insert({
      ...row,
      project_id: projectId,
      sort_order: sortOrder,
    })
    if (error) return { error: progressError(error) }
  }

  refreshProject(projectId)
  return { error: null }
}

export async function deleteProjectStage(
  projectId: string,
  stageId: string,
): Promise<ProgressActionResult> {
  const denied = await denyUnlessStageWrite("delete")
  if (denied) return { error: denied }
  if (!idPattern.test(projectId) || !idPattern.test(stageId)) {
    return { error: "That stage could not be found." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("project_stages")
    .delete()
    .eq("id", stageId)
    .eq("project_id", projectId)
  if (error) return { error: progressError(error) }
  refreshProject(projectId)
  return { error: null }
}

export async function moveProjectStage(
  projectId: string,
  stageId: string,
  direction: "up" | "down",
): Promise<ProgressActionResult> {
  const denied = await denyUnlessStageWrite("edit")
  if (denied) return { error: denied }
  if (!idPattern.test(projectId) || !idPattern.test(stageId)) {
    return { error: "That stage could not be found." }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_stages")
    .select("id, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error || !data) return { error: "Could not reorder stages." }

  const index = data.findIndex((row) => row.id === stageId)
  const swapWith = direction === "up" ? index - 1 : index + 1
  if (index < 0 || swapWith < 0 || swapWith >= data.length) return { error: null }

  const current = data[index]
  const neighbor = data[swapWith]
  const now = new Date().toISOString()
  if (current.sort_order === neighbor.sort_order) {
    const ordered = data.map((row) => row.id)
    const [moved] = ordered.splice(index, 1)
    ordered.splice(swapWith, 0, moved)
    for (let position = 0; position < ordered.length; position += 1) {
      const saved = await supabase
        .from("project_stages")
        .update({ sort_order: position + 1, updated_at: now })
        .eq("id", ordered[position])
        .eq("project_id", projectId)
      if (saved.error) return { error: progressError(saved.error) }
    }
    refreshProject(projectId)
    return { error: null }
  }
  const first = await supabase
    .from("project_stages")
    .update({ sort_order: neighbor.sort_order, updated_at: now })
    .eq("id", current.id)
    .eq("project_id", projectId)
  if (first.error) return { error: progressError(first.error) }
  const second = await supabase
    .from("project_stages")
    .update({ sort_order: current.sort_order, updated_at: now })
    .eq("id", neighbor.id)
    .eq("project_id", projectId)
  if (second.error) return { error: progressError(second.error) }

  refreshProject(projectId)
  return { error: null }
}

export async function createStagesFromTemplate(
  projectId: string,
): Promise<ProgressActionResult> {
  const denied = await denyUnlessStageWrite("add")
  if (denied) return { error: denied }
  if (!idPattern.test(projectId)) return { error: "That project could not be found." }

  const supabase = await createClient()
  const existing = await supabase
    .from("project_stages")
    .select("id")
    .eq("project_id", projectId)
    .limit(1)
  if (existing.error) return { error: "Could not create stages." }
  if ((existing.data ?? []).length > 0) {
    return { error: "This project already has stages." }
  }

  const templates = await supabase
    .from("project_stage_templates")
    .select("sort_order, name, weight")
    .order("sort_order", { ascending: true })
  if (templates.error) return { error: "Could not load the stage template." }
  if ((templates.data ?? []).length === 0) {
    return { error: "Add a stage template in Settings first." }
  }

  const now = new Date().toISOString()
  const { error } = await supabase.from("project_stages").insert(
    (templates.data ?? []).map((template) => ({
      project_id: projectId,
      sort_order: template.sort_order,
      name: template.name,
      weight: template.weight,
      status: "Not Started" as const,
      notes: "",
      updated_at: now,
    })),
  )
  if (error) return { error: progressError(error) }
  refreshProject(projectId)
  return { error: null }
}

export async function saveProjectMilestone(
  projectId: string,
  milestoneId: string | null,
  input: ProjectMilestoneInput,
): Promise<ProgressActionResult> {
  const denied = await denyUnlessEither(milestoneId ? "edit" : "add")
  if (denied) return { error: denied }
  if (!idPattern.test(projectId) || (milestoneId && !idPattern.test(milestoneId))) {
    return { error: "That milestone could not be found." }
  }

  const parsed = projectMilestoneSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: null,
      fieldErrors: {
        label: firstIssue(parsed.error, "label"),
        stageId: firstIssue(parsed.error, "stageId"),
        dueOn: firstIssue(parsed.error, "dueOn"),
        doneOn: firstIssue(parsed.error, "doneOn"),
        percentOfValue: firstIssue(parsed.error, "percentOfValue"),
        amount: firstIssue(parsed.error, "amount"),
      },
    }
  }

  const stageId = parsed.data.stageId
  if (stageId && !idPattern.test(stageId)) {
    return { error: null, fieldErrors: { stageId: "Choose a stage." } }
  }

  const percent = parsed.data.percentOfValue
    ? parseWeight(parsed.data.percentOfValue)
    : null
  const amount = parsed.data.amount ? parseAmount(parsed.data.amount) : null
  const supabase = await createClient()
  const row = {
    label: parsed.data.label,
    stage_id: stageId || null,
    due_on: parsed.data.dueOn || null,
    done_on: parsed.data.doneOn || null,
    percent_of_value: percent,
    amount,
    updated_at: new Date().toISOString(),
  }

  if (milestoneId) {
    const { error } = await supabase
      .from("project_milestones")
      .update(row)
      .eq("id", milestoneId)
      .eq("project_id", projectId)
    if (error) return { error: progressError(error) }
  } else {
    const { error } = await supabase.from("project_milestones").insert({
      ...row,
      project_id: projectId,
    })
    if (error) return { error: progressError(error) }
  }

  refreshProject(projectId)
  return { error: null }
}

export async function setMilestoneDone(
  projectId: string,
  milestoneId: string,
  done: boolean,
): Promise<ProgressActionResult> {
  const denied = await denyUnlessEither("edit")
  if (denied) return { error: denied }
  if (!idPattern.test(projectId) || !idPattern.test(milestoneId)) {
    return { error: "That milestone could not be found." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("project_milestones")
    .update({
      done_on: done ? businessTodayIsoDate() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", milestoneId)
    .eq("project_id", projectId)
  if (error) return { error: progressError(error) }
  refreshProject(projectId)
  return { error: null }
}

export async function deleteProjectMilestone(
  projectId: string,
  milestoneId: string,
): Promise<ProgressActionResult> {
  const denied = await denyUnlessEither("delete")
  if (denied) return { error: denied }
  if (!idPattern.test(projectId) || !idPattern.test(milestoneId)) {
    return { error: "That milestone could not be found." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("project_milestones")
    .delete()
    .eq("id", milestoneId)
    .eq("project_id", projectId)
  if (error) return { error: progressError(error) }
  refreshProject(projectId)
  return { error: null }
}

export async function importWorkOrderMilestones(
  projectId: string,
): Promise<ProgressActionResult> {
  const denied = await denyUnlessEither("add")
  if (denied) return { error: denied }
  if (!idPattern.test(projectId)) return { error: "That project could not be found." }

  const supabase = await createClient()
  const orders = await supabase
    .from("work_orders")
    .select("id, total")
    .eq("project_id", projectId)
  if (orders.error) {
    return { error: "Could not read work orders for this project." }
  }
  if ((orders.data ?? []).length === 0) {
    return { error: "This project has no work orders." }
  }

  const totals = new Map((orders.data ?? []).map((order) => [order.id, order.total]))
  const milestones = await supabase
    .from("work_order_milestones")
    .select("id, work_order_id, label, percent, sort_order")
    .in("work_order_id", [...totals.keys()])
    .order("sort_order", { ascending: true })
  if (milestones.error) {
    return { error: "Could not read work order milestones." }
  }

  const existing = await supabase
    .from("project_milestones")
    .select("work_order_milestone_id")
    .eq("project_id", projectId)
    .not("work_order_milestone_id", "is", null)
  if (existing.error) return { error: "Could not import milestones." }

  const imported = new Set(
    (existing.data ?? []).flatMap((row) =>
      row.work_order_milestone_id ? [row.work_order_milestone_id] : [],
    ),
  )
  const now = new Date().toISOString()
  const rows = (milestones.data ?? []).flatMap((milestone) => {
    if (imported.has(milestone.id)) return []
    const percent = Number(milestone.percent)
    const total = Number(totals.get(milestone.work_order_id) ?? 0)
    const amount =
      Number.isFinite(percent) && Number.isFinite(total)
        ? Math.round(total * percent) / 100
        : null
    return [
      {
        project_id: projectId,
        work_order_milestone_id: milestone.id,
        label: milestone.label,
        percent_of_value: Number.isFinite(percent) ? percent : null,
        amount,
        updated_at: now,
      },
    ]
  })

  if (rows.length === 0) {
    return { error: "Work order milestones are already imported." }
  }

  const { error } = await supabase.from("project_milestones").insert(rows)
  if (error) return { error: progressError(error) }
  refreshProject(projectId)
  return { error: null }
}

async function denyUnlessEither(action: PermissionAction): Promise<string | null> {
  const progress = await denyUnless("project_progress", action)
  const projects = await denyUnless("projects", action)
  if (progress && projects) return projects
  return null
}

async function denyUnlessStageWrite(action: PermissionAction): Promise<string | null> {
  const denied = await denyUnlessEither(action)
  if (denied) return denied
  const projectsEdit = await denyUnless("projects", "edit")
  if (projectsEdit) {
    return "Saving a stage updates the project completion figure, which needs permission to edit projects."
  }
  return null
}

async function nextSortOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
): Promise<number> {
  const { data } = await supabase
    .from("project_stages")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
  const current = data?.[0]?.sort_order ?? 0
  return current + 1
}

function refreshProject(projectId: string) {
  revalidatePath("/projects")
  revalidatePath(`/projects/${projectId}`)
  revalidatePath("/settings")
}

function progressError(error: { message?: string; code?: string }): string {
  const message = error.message ?? ""
  if (message.includes("permission to edit this project")) {
    return "Saving progress updates the project completion figure, which needs permission to edit projects."
  }
  return friendlyDbError(error, "Could not save project progress.")
}
