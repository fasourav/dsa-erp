"use client"

import { Lock } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import {
  emptyFlags,
  type ModuleOption,
  type PermissionFlags,
  type PermissionMatrix,
} from "@/app/(app)/settings/users/types"

const actions = [
  ["canView", "View"],
  ["canAdd", "Add"],
  ["canEdit", "Edit"],
  ["canDelete", "Delete"],
] as const

export function PermissionMatrixEditor({
  modules,
  matrix,
  disabled,
  lockOwnersOnly,
  onToggle,
}: {
  modules: ModuleOption[]
  matrix: PermissionMatrix
  disabled?: boolean
  lockOwnersOnly?: boolean
  onToggle: (module: string, field: keyof PermissionFlags, value: boolean) => void
}) {
  return (
    <div className="min-w-0 overflow-x-auto rounded-card border border-border">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Module</TableHead>
            {actions.map(([, label]) => (
              <TableHead key={label} className="text-center">
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {modules.map((module) => {
            const flags = matrix[module.key] ?? emptyFlags()
            const locked = Boolean(disabled || (lockOwnersOnly && module.ownersOnly))
            return (
              <TableRow key={module.key}>
                <TableCell className="font-medium whitespace-normal">
                  <span className="flex items-center gap-2">
                    {module.label}
                    {module.ownersOnly ? (
                      <span className="inline-flex items-center gap-1 text-label font-normal text-muted-foreground">
                        <Lock aria-hidden="true" className="size-3" />
                        Owners Only
                      </span>
                    ) : null}
                  </span>
                </TableCell>
                {actions.map(([field, label]) => (
                  <TableCell key={field} className="text-center">
                    <AccessToggle
                      checked={module.ownersOnly && lockOwnersOnly ? false : flags[field]}
                      disabled={locked}
                      label={`${module.label} ${label}`}
                      onChange={(value) => onToggle(module.key, field, value)}
                    />
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export function AccessToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (value: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-8 w-14 items-center rounded-full border border-input transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        checked ? "bg-primary" : "bg-muted",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "size-6 rounded-full bg-primary-foreground shadow-sm transition-transform",
          checked ? "translate-x-7" : "translate-x-1",
        )}
      />
    </button>
  )
}

export function RolePills({
  templates,
  value,
  disabled,
  onChange,
}: {
  templates: Array<{ key: string; label: string }>
  value: string
  disabled?: boolean
  onChange: (key: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Role Template">
      {templates.map((template) => {
        const selected = template.key === value
        return (
          <Button
            key={template.key}
            type="button"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(template.key)}
          >
            {template.label}
          </Button>
        )
      })}
    </div>
  )
}
