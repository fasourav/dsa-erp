import { z } from "zod"

import { amountError, businessTodayIsoDate } from "@/lib/project-validation"

export const stageStatuses = ["Not Started", "In Progress", "Done"] as const

export type StageStatus = (typeof stageStatuses)[number]

export type StageTemplate = {
  id: string
  sortOrder: number
  name: string
  weight: number
}

export type ProjectStage = {
  id: string
  sortOrder: number
  name: string
  weight: number
  status: StageStatus
  plannedStart: string
  plannedEnd: string
  doneOn: string
  notes: string
}

export type ProjectMilestone = {
  id: string
  stageId: string
  workOrderMilestoneId: string | null
  label: string
  dueOn: string
  doneOn: string
  percentOfValue: number | null
  amount: number | null
}

export type ProjectProgressData = {
  progressPercent: number
  stages: ProjectStage[]
  milestones: ProjectMilestone[]
  templates: StageTemplate[]
}

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Enter a valid date.")

const weightInput = z
  .string()
  .trim()
  .refine((value) => parseWeight(value) !== null, "Enter a weight from 0 to 100.")

const optionalPercent = z.string().trim().refine((value) => {
  if (value === "") return true
  const parsed = parseWeight(value)
  return parsed !== null
}, "Enter a percent from 0 to 100.")

const optionalAmount = z.string().trim().refine((value) => {
  if (value === "") return true
  return parseAmount(value) !== null
}, "Enter an amount of 0 or more.")

export const projectStageSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a stage name.").max(120),
    weight: weightInput,
    status: z.enum(stageStatuses),
    plannedStart: optionalDate,
    plannedEnd: optionalDate,
    doneOn: optionalDate,
    notes: z.string().trim().max(4000),
  })
  .superRefine((value, ctx) => {
    if (
      value.plannedStart &&
      value.plannedEnd &&
      value.plannedEnd < value.plannedStart
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Planned end cannot be before the planned start.",
        path: ["plannedEnd"],
      })
    }
  })

export const projectMilestoneSchema = z.object({
  label: z.string().trim().min(1, "Enter a milestone name.").max(160),
  stageId: z.string().trim(),
  dueOn: optionalDate,
  doneOn: optionalDate,
  percentOfValue: optionalPercent,
  amount: optionalAmount,
})

export const stageTemplateSchema = z.object({
  name: z.string().trim().min(1, "Enter a stage name.").max(120),
  weight: weightInput,
})

export type ProjectStageInput = z.infer<typeof projectStageSchema>
export type ProjectMilestoneInput = z.infer<typeof projectMilestoneSchema>
export type StageTemplateInput = z.infer<typeof stageTemplateSchema>

export function parseWeight(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return null
  return parsed
}

export function parseAmount(value: string): number | null {
  const trimmed = value.replace(/,/g, "").trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

/** One milestone may not exceed MAX_AMOUNT or that project's value. The sum of milestones is not capped. */
export function milestoneAmountError(value: string, projectValue: number | null): string | null {
  const capped = amountError(value, "amount")
  if (capped) return capped
  if (value.trim() === "") return null
  const parsed = parseAmount(value)
  if (parsed === null) return "Enter an amount of 0 or more."
  if (projectValue !== null && Math.round(parsed * 100) > Math.round(projectValue * 100)) {
    return "Amount cannot be more than the project value."
  }
  return null
}

export function doneOnBeforeStartError(doneOn: string, startedOn: string | null): string | null {
  const done = doneOn.trim()
  const start = startedOn?.slice(0, 10) ?? ""
  if (!done || !start) return null
  if (done < start) return "Done On cannot be before the project start date."
  return null
}

export function isStageStatus(value: string): value is StageStatus {
  return stageStatuses.some((status) => status === value)
}

export function weightTotal(stages: readonly { weight: number }[]): number {
  return Math.round(stages.reduce((total, stage) => total + stage.weight, 0) * 100) / 100
}

export function isOverdueMilestone(
  milestone: { dueOn: string; doneOn: string },
  today = businessTodayIsoDate(),
): boolean {
  return Boolean(milestone.dueOn) && !milestone.doneOn && milestone.dueOn < today
}

