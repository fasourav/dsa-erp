import { blankLine, type LineInput, type MilestoneInput } from "@/lib/documents/drafts"
import type { DocumentTemplateInput } from "@/lib/schemas"
import type { Json } from "@/types/database.types"

export type DocumentTemplateKind = DocumentTemplateInput["kind"]

export type DocumentTemplateLine = DocumentTemplateInput["lines"][number]
export type DocumentTemplateMilestone = DocumentTemplateInput["milestones"][number]

export type DocumentTemplate = {
  id: string
  kind: DocumentTemplateKind
  name: string
  projectType: string
  scopeText: string
  termsText: string
  paymentTerms: string
  lines: DocumentTemplateLine[]
  milestones: DocumentTemplateMilestone[]
  isActive: boolean
}

export function kindLabel(kind: DocumentTemplateKind): string {
  return kind === "work_order" ? "Work Order" : "Quotation"
}

export function storedTemplateLines(lines: DocumentTemplateLine[]): Json {
  return lines.map((line) => ({
    description: line.description,
    unit: line.unit,
    qty: Number(line.qty.replace(/,/g, "")),
    rate: Number(line.rate.replace(/,/g, "")),
  }))
}

export function storedTemplateMilestones(milestones: DocumentTemplateMilestone[]): Json {
  return milestones.map((milestone) => ({
    label: milestone.label,
    percent: Number(milestone.percent),
  }))
}

export function parseTemplateLines(value: Json): DocumentTemplateLine[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
    const description = text(entry, "description")
    const unit = text(entry, "unit")
    const qty = numberText(entry, "qty")
    const rate = numberText(entry, "rate")
    if (!description || !unit || !qty || !rate) return []
    return [{ description, unit, qty, rate }]
  })
}

export function parseTemplateMilestones(value: Json): DocumentTemplateMilestone[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
    const label = text(entry, "label")
    const percent = numberText(entry, "percent")
    if (!label || !percent) return []
    return [{ label, percent }]
  })
}

export function draftLinesFromTemplate(lines: DocumentTemplateLine[]): LineInput[] {
  if (lines.length === 0) return [blankLine()]
  return lines.map((line) => ({
    section: "",
    item: line.description,
    specification: "",
    quantity: line.qty,
    unit: line.unit,
    unitPrice: line.rate,
  }))
}

export function templateLinesFromDraft(lines: LineInput[]): DocumentTemplateLine[] {
  return lines.flatMap((line) => {
    const description = line.item.trim()
    if (!description) return []
    return [
      {
        description,
        unit: line.unit.trim() || "Job",
        qty: line.quantity.trim() || "1",
        rate: line.unitPrice.trim() || "0",
      },
    ]
  })
}

export function draftMilestonesFromTemplate(
  milestones: DocumentTemplateMilestone[],
): MilestoneInput[] {
  return milestones.map((milestone) => ({
    label: milestone.label,
    percent: milestone.percent,
  }))
}

export function templateMilestonesFromDraft(
  milestones: MilestoneInput[],
): DocumentTemplateMilestone[] {
  return milestones.flatMap((milestone) => {
    const label = milestone.label.trim()
    if (!label) return []
    return [{ label, percent: milestone.percent.trim() }]
  })
}

export function joinedTerms(termsText: string, paymentTerms: string): string {
  return [termsText, paymentTerms]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n")
}

export function nextCopyName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((item) => item.trim().toLowerCase()))
  // Shorten the original name, never the suffix, so a long name still gets a unique copy name.
  const withSuffix = (suffix: string) => `${name.trim().slice(0, 120 - suffix.length).trimEnd()}${suffix}`
  const first = withSuffix(" Copy")
  if (!taken.has(first.toLowerCase())) return first
  for (let index = 2; index < 100; index += 1) {
    const candidate = withSuffix(` Copy ${index}`)
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
  return withSuffix(` Copy ${Date.now()}`)
}

function text(entry: { [key: string]: Json | undefined }, key: string): string {
  const value = entry[key]
  return typeof value === "string" ? value.trim() : ""
}

function numberText(entry: { [key: string]: Json | undefined }, key: string): string {
  const value = entry[key]
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string" && value.trim() !== "") return value.trim()
  return ""
}
