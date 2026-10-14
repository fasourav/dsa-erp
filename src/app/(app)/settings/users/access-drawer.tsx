"use client"

import { useState } from "react"

import {
  AccessToggle,
  PermissionMatrixEditor,
  RolePills,
} from "@/app/(app)/settings/users/permission-matrix"
import {
  emptyFlags,
  type AccessInput,
  type DirectoryUser,
  type ModuleOption,
  type PermissionFlags,
  type PermissionMatrix,
  type RoleTemplateOption,
} from "@/app/(app)/settings/users/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AccessDrawer({
  open,
  mode,
  user,
  self,
  modules,
  templates,
  pending,
  error,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  mode: "invite" | "edit"
  user: DirectoryUser | null
  self: boolean
  modules: ModuleOption[]
  templates: RoleTemplateOption[]
  pending: boolean
  error: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (input: AccessInput) => void
}) {
  const [displayName, setDisplayName] = useState(user?.displayName ?? "")
  const [designation, setDesignation] = useState(user?.designation ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const [role, setRole] = useState(user?.role ?? templates[0]?.key ?? "")
  const [showFinancials, setShowFinancials] = useState(user?.showFinancials ?? false)
  const [matrix, setMatrix] = useState<PermissionMatrix>(user?.permissions ?? {})

  function applyTemplate(key: string) {
    const template = templates.find((item) => item.key === key)
    if (!template) return
    setRole(key)
    setShowFinancials(template.showFinancials)
    setMatrix(template.permissions)
  }

  function toggle(module: string, field: keyof PermissionFlags, value: boolean) {
    setMatrix((current) => ({
      ...current,
      [module]: { ...(current[module] ?? emptyFlags()), [field]: value },
    }))
    if (role !== "custom") setRole("custom")
  }

  function submit() {
    onSubmit({
      displayName,
      designation,
      email,
      role,
      showFinancials,
      permissions: modules.map((module) => ({
        module: module.key,
        ...(matrix[module.key] ?? emptyFlags()),
      })),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="drawer" className="overflow-hidden">
        <DialogHeader>
          <DialogTitle>{mode === "invite" ? "Invite User" : "Edit Access"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FieldGroup layout="inset">
            <Field span="half">
              <FieldLabel htmlFor="user-name">Full Name</FieldLabel>
              <Input
                id="user-name"
                value={displayName}
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </Field>
            <Field span="half">
              <FieldLabel htmlFor="user-email">Email</FieldLabel>
              <Input
                id="user-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                value={email}
                disabled={mode === "edit"}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="user-designation">Designation</FieldLabel>
              <Input
                id="user-designation"
                value={designation}
                autoComplete="organization-title"
                autoCapitalize="words"
                enterKeyHint="done"
                placeholder="Optional"
                onChange={(event) => setDesignation(event.target.value)}
              />
            </Field>
            <Field>
              <FieldTitle>Role Template</FieldTitle>
              <RolePills
                templates={templates}
                value={role}
                disabled={self}
                onChange={applyTemplate}
              />
            </Field>
          </FieldGroup>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
            <Label htmlFor="show-financials">Show Financial Figures</Label>
            <AccessToggle
              checked={showFinancials}
              disabled={self}
              label="Show Financial Figures"
              onChange={setShowFinancials}
            />
          </div>

          <p className="rounded-card bg-muted px-4 py-3 text-sm text-muted-foreground">
            Settings And Users & Permissions Are Visible To Owners Only.
          </p>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <PermissionMatrixEditor
            modules={modules}
            matrix={matrix}
            disabled={self || role === "owner"}
            lockOwnersOnly={role !== "owner"}
            onToggle={toggle}
          />
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending} onClick={submit}>
            {mode === "invite" ? "Send Invite" : "Save Access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
