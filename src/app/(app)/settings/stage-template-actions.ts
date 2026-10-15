"use server"

import { revalidatePath } from "next/cache"

import { friendlyDbError } from "@/lib/db-errors"
import {
  parseWeight,
  stageTemplateSchema,
  type StageTemplateInput,
} from "@/lib/project-progress"
import { denyUnlessOwner } from "@/lib/permissions"
import { firstIssue } from "@/lib/schemas"
import { createClient } from "@/lib/supabase/server"

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TemplateActionResult = {
  error: string | null
  fieldErrors?: { name?: string; weight?: string }
}

export async function saveStageTemplate(
  templateId: string | null,
  input: StageTemplateInput,
): Promise<TemplateActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }
  if (templateId && !idPattern.test(templateId)) {
    return { error: "That stage could not be found." }
  }

  const parsed = stageTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: null,
      fieldErrors: {
        name: firstIssue(parsed.error, "name"),
        weight: firstIssue(parsed.error, "weight"),
      },
    }
  }

  const weight = parseWeight(parsed.data.weight)
  if (weight === null) return { error: "Enter a weight from 0 to 100." }

  const supabase = await createClient()
  const row = {
    name: parsed.data.name,
    weight,
    updated_at: new Date().toISOString(),
  }

  if (templateId) {
    const { error } = await supabase
      .from("project_stage_templates")
      .update(row)
      .eq("id", templateId)
    if (error) return { error: templateError(error) }
  } else {
    const { data } = await supabase
      .from("project_stage_templates")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
    const { error } = await supabase.from("project_stage_templates").insert({
      ...row,
      sort_order: (data?.[0]?.sort_order ?? 0) + 1,
    })
    if (error) return { error: templateError(error) }
  }

  revalidatePath("/settings")
  revalidatePath("/projects")
  return { error: null }
}

export async function deleteStageTemplate(templateId: string): Promise<TemplateActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }
  if (!idPattern.test(templateId)) return { error: "That stage could not be found." }

  const supabase = await createClient()
  const { error } = await supabase.from("project_stage_templates").delete().eq("id", templateId)
  if (error) return { error: templateError(error) }
  revalidatePath("/settings")
  return { error: null }
}

export async function moveStageTemplate(
  templateId: string,
  direction: "up" | "down",
): Promise<TemplateActionResult> {
  const denied = await denyUnlessOwner()
  if (denied) return { error: denied }
  if (!idPattern.test(templateId)) return { error: "That stage could not be found." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("project_stage_templates")
    .select("id, sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
  if (error || !data) return { error: "Could not reorder the template." }

  const index = data.findIndex((row) => row.id === templateId)
  const swapWith = direction === "up" ? index - 1 : index + 1
  if (index < 0 || swapWith < 0 || swapWith >= data.length) return { error: null }

  const current = data[index]
  const neighbor = data[swapWith]
  const now = new Date().toISOString()
  const first = await supabase
    .from("project_stage_templates")
    .update({ sort_order: neighbor.sort_order, updated_at: now })
    .eq("id", current.id)
  if (first.error) return { error: templateError(first.error) }
  const second = await supabase
    .from("project_stage_templates")
    .update({ sort_order: current.sort_order, updated_at: now })
    .eq("id", neighbor.id)
  if (second.error) return { error: templateError(second.error) }

  revalidatePath("/settings")
  return { error: null }
}

function templateError(error: { message?: string; code?: string }): string {
  const message = error.message ?? ""
  if (/duplicate key|unique/i.test(message)) {
    return "A stage with this name already exists."
  }
  return friendlyDbError(error, "Could not save the stage template.")
}
