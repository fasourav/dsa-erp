import { z } from "zod"

import { DEFAULT_LAUNCH_DATE } from "@/lib/format"
import { phoneErrorForStored } from "@/lib/phone"

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const launchDateMessage = "Use a date on or after 01 Jan 2021."

export const optionalEmail = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || emailPattern.test(value),
    "Enter a valid email address.",
  )

export const optionalPhone = z.string().trim().superRefine((value, ctx) => {
  const message = phoneErrorForStored(value)
  if (!message) return
  ctx.addIssue({ code: "custom", message })
})

export const launchDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.")
  .refine((value) => value >= DEFAULT_LAUNCH_DATE, launchDateMessage)

export const positiveAmount = z
  .string()
  .trim()
  .refine((value) => {
    const parsed = Number(value.replace(/,/g, ""))
    return Number.isFinite(parsed) && parsed > 0
  }, "Enter an amount greater than 0.")

export const wholeQuantity = z
  .string()
  .trim()
  .refine((value) => /^\d+$/.test(value) && Number(value) >= 1, "Enter a whole quantity of at least 1.")

export const budgetYear = z
  .string()
  .trim()
  .refine((value) => {
    if (!/^\d{4}$/.test(value)) return false
    const year = Number(value)
    return year >= 2021 && year <= 2100
  }, "Enter a year from 2021 onward.")

export const leadContactSchema = z.object({
  email: optionalEmail,
  phone: optionalPhone,
  addedOn: launchDate,
})

export const projectValueSchema = z.object({
  startedOn: launchDate,
  totalValue: positiveAmount,
})

export const purchaseOrderValueSchema = z.object({
  totalValue: positiveAmount,
})

export const assetQuantitySchema = z.object({
  quantity: wholeQuantity,
})

export const employeeLeaveSchema = z
  .object({
    joiningDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a joining date."),
    leaveDate: z.string().trim(),
  })
  .refine(
    (value) => value.leaveDate === "" || value.leaveDate >= value.joiningDate,
    {
      message: "Leave date cannot be before the joining date.",
      path: ["leaveDate"],
    },
  )

export const documentTemplateKindSchema = z.enum(["quotation", "work_order"])

export const documentTemplateNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name.")
  .max(120, "Use 120 characters or fewer.")

const templateAmount = z
  .string()
  .trim()
  .refine((value) => {
    const parsed = Number(value.replace(/,/g, ""))
    return Number.isFinite(parsed) && parsed >= 0
  }, "Enter a rate of 0 or more.")

const templateQuantity = z
  .string()
  .trim()
  .refine((value) => {
    const parsed = Number(value.replace(/,/g, ""))
    return Number.isFinite(parsed) && parsed > 0
  }, "Enter a quantity greater than 0.")

export const documentTemplateLineSchema = z.object({
  description: z.string().trim().min(1, "Enter a description."),
  unit: z.string().trim().min(1, "Enter a unit."),
  qty: templateQuantity,
  rate: templateAmount,
})

export const documentTemplateMilestoneSchema = z.object({
  label: z.string().trim().min(1, "Enter a milestone."),
  percent: z
    .string()
    .trim()
    .refine((value) => {
      const parsed = Number(value)
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    }, "Enter a percent from 0 to 100."),
})

export const documentTemplateSchema = z
  .object({
    kind: documentTemplateKindSchema,
    name: documentTemplateNameSchema,
    projectType: z.string().trim(),
    scopeText: z.string(),
    termsText: z.string(),
    paymentTerms: z.string(),
    lines: z.array(documentTemplateLineSchema),
    milestones: z.array(documentTemplateMilestoneSchema),
    isActive: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.milestones.length === 0) return
    const total = value.milestones.reduce((sum, milestone) => sum + Number(milestone.percent), 0)
    if (Math.abs(total - 100) > 0.05) {
      ctx.addIssue({
        code: "custom",
        message: "Milestone percents must total 100.",
        path: ["milestones"],
      })
    }
  })

export type DocumentTemplateInput = z.infer<typeof documentTemplateSchema>

export function firstIssue(error: z.ZodError, field: string): string | undefined {
  return error.issues.find((issue) => issue.path[0] === field)?.message
}
