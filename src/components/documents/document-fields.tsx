"use client"

import { Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  blankLine,
  blankMilestone,
  type EmployeeChoice,
  type LineInput,
  type MilestoneInput,
} from "@/lib/documents/drafts"

export function TextField({
  id,
  label,
  value,
  onChange,
  disabled,
  type = "text",
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  type?: "text" | "date" | "number"
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function AreaField({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

export function ChoiceField({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = "Choose",
}: {
  id: string
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const items = [
    ...(value ? [] : [{ value: "unset", label: placeholder }]),
    ...options.filter((option) => option.value !== "unset"),
  ]
  const selected = value || "unset"

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        items={items}
        value={selected}
        disabled={disabled || options.length === 0}
        onValueChange={(next) => onChange(!next || next === "unset" ? "" : next)}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export function EmployeeField({
  id,
  label,
  value,
  employees,
  onChange,
  disabled,
}: {
  id: string
  label: string
  value: string
  employees: EmployeeChoice[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const names = new Set(employees.map((employee) => employee.name))
  const options = [
    { value: "none", label: "—" },
    ...(value && !names.has(value) ? [{ value, label: value }] : []),
    ...employees.map((employee) => ({
      value: employee.name,
      label: employee.designation ? `${employee.name} · ${employee.designation}` : employee.name,
    })),
  ]
  return (
    <ChoiceField
      id={id}
      label={label}
      value={value || "none"}
      options={options}
      disabled={disabled}
      onChange={(next) => onChange(next === "none" ? "" : next)}
    />
  )
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  )
}

export function LineEditor({
  lines,
  onChange,
  disabled,
  showSection = true,
}: {
  lines: LineInput[]
  onChange: (lines: LineInput[]) => void
  disabled?: boolean
  showSection?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">Items</p>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || lines.length >= 40}
          onClick={() => onChange([...lines, blankLine()])}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add item
        </Button>
      </div>
      {lines.map((line, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">Item {String(index + 1).padStart(2, "0")}</p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled || lines.length === 1}
              aria-label={`Remove item ${index + 1}`}
              onClick={() => onChange(lines.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {showSection ? (
              <TextField
                id={`section-${index}`}
                label="Section"
                value={line.section}
                disabled={disabled}
                onChange={(section) => updateLine(lines, index, { section }, onChange)}
              />
            ) : null}
            <TextField
              id={`item-${index}`}
              label="Item"
              value={line.item}
              disabled={disabled}
              onChange={(item) => updateLine(lines, index, { item }, onChange)}
            />
            <TextField
              id={`spec-${index}`}
              label="Specification"
              value={line.specification}
              disabled={disabled}
              onChange={(specification) => updateLine(lines, index, { specification }, onChange)}
            />
            <TextField
              id={`qty-${index}`}
              label="Quantity"
              value={line.quantity}
              disabled={disabled}
              onChange={(quantity) => updateLine(lines, index, { quantity }, onChange)}
            />
            <TextField
              id={`unit-${index}`}
              label="Unit"
              value={line.unit}
              disabled={disabled}
              onChange={(unit) => updateLine(lines, index, { unit }, onChange)}
            />
            <TextField
              id={`price-${index}`}
              label="Unit Price"
              value={line.unitPrice}
              disabled={disabled}
              onChange={(unitPrice) => updateLine(lines, index, { unitPrice }, onChange)}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export function MilestoneEditor({
  milestones,
  onChange,
  disabled,
}: {
  milestones: MilestoneInput[]
  onChange: (milestones: MilestoneInput[]) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium">Payment schedule</p>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || milestones.length >= 12}
          onClick={() => onChange([...milestones, blankMilestone()])}
        >
          <Plus aria-hidden="true" className="size-4" />
          Add milestone
        </Button>
      </div>
      {milestones.map((milestone, index) => (
        <div key={index} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
          <TextField
            id={`milestone-${index}`}
            label="Milestone"
            value={milestone.label}
            disabled={disabled}
            onChange={(label) => {
              const next = milestones.slice()
              next[index] = { ...milestone, label }
              onChange(next)
            }}
          />
          <TextField
            id={`percent-${index}`}
            label="Percent"
            value={milestone.percent}
            disabled={disabled}
            onChange={(percent) => {
              const next = milestones.slice()
              next[index] = { ...milestone, percent }
              onChange(next)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label={`Remove milestone ${index + 1}`}
            onClick={() => onChange(milestones.filter((_, itemIndex) => itemIndex !== index))}
          >
            <Trash2 aria-hidden="true" className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}

function updateLine(
  lines: LineInput[],
  index: number,
  patch: Partial<LineInput>,
  onChange: (lines: LineInput[]) => void,
) {
  const next = lines.slice()
  next[index] = { ...lines[index], ...patch }
  onChange(next)
}
