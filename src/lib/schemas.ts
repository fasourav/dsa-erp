import { z } from "zod"

import { DEFAULT_LAUNCH_DATE } from "@/lib/format"

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const launchDateMessage = "Use a date on or after 01 Jan 2021."

export const optionalEmail = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || emailPattern.test(value),
    "Enter a valid email address.",
  )

export const optionalPhone = z
  .string()
  .trim()
  .refine((value) => {
    if (value === "") return true
    return (value.match(/\d/g) ?? []).length >= 11
  }, "Enter a phone number with at least 11 digits.")

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

export function firstIssue(error: z.ZodError, field: string): string | undefined {
  return error.issues.find((issue) => issue.path[0] === field)?.message
}
