import type { Json } from "@/types/database.types"
import type { LineInput, MilestoneInput } from "@/lib/documents/drafts"

export function clip(value: string, max: number): string {
  return value.replace(/\u0000/g, "").trim().slice(0, max)
}

export function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 100) / 100
}

function asRecord(value: Json | null | undefined): Record<string, Json | undefined> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value
  return {}
}

function text(record: Record<string, Json | undefined>, key: string): string {
  const value = record[key]
  return typeof value === "string" ? value : ""
}

export function parseLines(value: Json | undefined): LineInput[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
    return [
      {
        section: text(entry, "section"),
        item: text(entry, "item"),
        specification: text(entry, "specification"),
        quantity: text(entry, "quantity"),
        unit: text(entry, "unit"),
        unitPrice: text(entry, "unitPrice"),
      },
    ]
  })
}

export function parseMilestones(value: Json | undefined): MilestoneInput[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return []
    return [{ label: text(entry, "label"), percent: text(entry, "percent") }]
  })
}

export function readBody(value: Json | null | undefined): Record<string, Json | undefined> {
  return asRecord(value)
}

export function readText(value: Json | null | undefined, key: string): string {
  return text(asRecord(value), key)
}

export function linesToJson(lines: LineInput[]): Json {
  return lines
    .filter((line) => line.item.trim())
    .slice(0, 40)
    .map((line) => ({
      section: clip(line.section, 120),
      item: clip(line.item, 200),
      specification: clip(line.specification, 400),
      quantity: clip(line.quantity, 40),
      unit: clip(line.unit, 40),
      unitPrice: clip(line.unitPrice, 40),
    }))
}

export function storedLines(lines: LineInput[]) {
  return lines
    .filter((line) => line.item.trim())
    .slice(0, 39)
    .map((line, index) => ({
      sort_order: index,
      section_name: clip(line.section, 120),
      item: clip(line.item, 200),
      specification: clip(line.specification, 400),
      quantity: numberOrNull(line.quantity),
      unit: clip(line.unit, 40),
      unit_price: numberOrNull(line.unitPrice),
    }))
}

export function storedMilestones(milestones: MilestoneInput[]) {
  return milestones
    .filter((milestone) => milestone.label.trim())
    .slice(0, 11)
    .flatMap((milestone, index) => {
      const percent = Number(milestone.percent)
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) return []
      return [
        {
          sort_order: index,
          label: clip(milestone.label, 200),
          percent: Math.round(percent * 100) / 100,
        },
      ]
    })
}

export function rowToLine(row: {
  section_name: string
  item: string
  specification: string
  quantity: number | null
  unit: string
  unit_price: number | null
}): LineInput {
  return {
    section: row.section_name,
    item: row.item,
    specification: row.specification,
    quantity: row.quantity === null ? "" : String(row.quantity),
    unit: row.unit,
    unitPrice: row.unit_price === null ? "" : String(row.unit_price),
  }
}

export function rowToMilestone(row: { label: string; percent: number }): MilestoneInput {
  return { label: row.label, percent: String(row.percent) }
}
