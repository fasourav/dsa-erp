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
      <DialogContent variant="drawer">
        <DialogHeader className="border-b px-4 py-4 pr-14">
          <DialogTitle>{mode === "invite" ? "Invite User" : "Edit Access"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-1 flex-col gap-4 px-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-name">Full Name</Label>
              <Input
                id="user-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                value={email}
                disabled={mode === "edit"}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="user-designation">Designation</Label>
            <Input
              id="user-designation"
              value={designation}
              onChange={(event) => setDesignation(event.target.value)}
              placeholder="Optional"
              autoComplete="organization-title"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Role Template</Label>
            <RolePills
              templates={templates}
              value={role}
              disabled={self}
              onChange={applyTemplate}
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
            <Label htmlFor="show-financials">Show Financial Figures</Label>
            <AccessToggle
              checked={showFinancials}
              disabled={self}
              label="Show Financial Figures"
              onChange={setShowFinancials}
            />
          </div>

          <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
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
        <DialogFooter className="mx-0 mb-0 rounded-none">
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
