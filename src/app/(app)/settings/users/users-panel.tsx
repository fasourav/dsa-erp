"use client"

import { savedToast } from "@/lib/saved"
import { useMemo, useState, useSyncExternalStore, useTransition } from "react"

import { AccessDrawer } from "@/app/(app)/settings/users/access-drawer"
import {
  cancelInvite,
  inviteUser,
  resendInvite,
  saveRoleTemplate,
  saveUserAccess,
  setUserActive,
} from "@/app/(app)/settings/users/actions"
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
import { SlideToDelete } from "@/components/slide-to-delete"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDayMonYear } from "@/lib/format"
import { cn } from "@/lib/utils"

const tabs = [
  { id: "users", label: "Users" },
  { id: "templates", label: "Role Templates" },
  { id: "pending", label: "Pending Invites" },
] as const

type TabId = (typeof tabs)[number]["id"]

export function UsersPanel({
  currentUserId,
  users,
  modules,
  templates,
  error,
}: {
  currentUserId: string
  users: DirectoryUser[]
  modules: ModuleOption[]
  templates: RoleTemplateOption[]
  error: string | null
}) {
  const [tab, setTab] = useState<TabId>("users")
  const [query, setQuery] = useState("")
  const [drawer, setDrawer] = useState<"invite" | "edit" | null>(null)
  const [editing, setEditing] = useState<DirectoryUser | null>(null)
  const [drawerSession, setDrawerSession] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<
    { kind: "deactivate" | "cancel"; user: DirectoryUser } | null
  >(null)
  const [pending, startTransition] = useTransition()

  const counts = {
    total: users.length,
    active: users.filter((user) => user.status === "active").length,
    pending: users.filter((user) => user.status === "invited").length,
    deactivated: users.filter((user) => user.status === "deactivated").length,
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const source = tab === "pending" ? users.filter((user) => user.status === "invited") : users
    if (!needle) return source
    return source.filter((user) =>
      `${user.displayName} ${user.email}`.toLowerCase().includes(needle),
    )
  }, [query, tab, users])

  function openInvite() {
    setEditing(null)
    setFormError(null)
    setDrawer("invite")
    setDrawerSession((value) => value + 1)
  }

  function openEdit(user: DirectoryUser) {
    setEditing(user)
    setFormError(null)
    setDrawer("edit")
    setDrawerSession((value) => value + 1)
  }

  function submitAccess(input: AccessInput) {
    setFormError(null)
    startTransition(async () => {
      const result =
        drawer === "invite" || !editing
          ? await inviteUser(input)
          : await saveUserAccess(editing.id, input)
      if (result.error) {
        setFormError(result.error)
        return
      }
      savedToast()
      setDrawer(null)
    })
  }

  function runUserAction(task: () => Promise<{ error: string | null }>) {
    setPageError(null)
    startTransition(async () => {
      try {
        const result = await task()
        if (result.error) setPageError(result.error)
        else setConfirm(null)
      } catch {
        setPageError("Could not update this user.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Admin / Users & Permissions</p>
        <h1 className="text-2xl font-medium tracking-tight">Users & Permissions</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total Users" value={counts.total} />
        <Stat label="Active" value={counts.active} />
        <Stat label="Pending Invites" value={counts.pending} />
        <Stat label="Deactivated" value={counts.deactivated} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Users & Permissions">
          {tabs.map((item) => (
            <Button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              variant={tab === item.id ? "default" : "outline"}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        {tab === "users" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Users"
              aria-label="Search Users"
            />
            <Button type="button" onClick={openInvite}>
              Invite User
            </Button>
          </div>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {pageError ? (
        <p role="alert" className="text-sm text-destructive">
          {pageError}
        </p>
      ) : null}

      {tab === "templates" ? (
        <TemplateEditor modules={modules} templates={templates} users={users} />
      ) : (
        <UserTable
          users={filtered}
          templates={templates}
          currentUserId={currentUserId}
          pending={pending}
          onEdit={openEdit}
          onResend={(user) => runUserAction(() => resendInvite(user.id))}
          onCancel={(user) => setConfirm({ kind: "cancel", user })}
          onDeactivate={(user) => setConfirm({ kind: "deactivate", user })}
          onReactivate={(user) => runUserAction(() => setUserActive(user.id, true))}
        />
      )}

      {tab === "users" ? (
        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Role Templates</span>
              {templates.map((template) => {
                const count = users.filter((user) => user.role === template.key).length
                return (
                  <Badge key={template.id} variant="outline" className="rounded-full">
                    {template.label} · {count} {count === 1 ? "User" : "Users"}
                  </Badge>
                )
              })}
            </div>
            <Button type="button" variant="outline" onClick={() => setTab("templates")}>
              Edit Templates
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {drawer ? (
        <AccessDrawer
          key={`${drawer}-${editing?.id ?? "new"}-${drawerSession}`}
          open
          mode={drawer}
          user={editing}
          self={editing?.id === currentUserId}
          modules={modules}
          templates={templates}
          pending={pending}
          error={formError}
          onOpenChange={(next) => {
            if (!next) setDrawer(null)
          }}
          onSubmit={submitAccess}
        />
      ) : null}

      <AlertDialog open={Boolean(confirm)} onOpenChange={(next) => !next && !pending && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "cancel" ? "Cancel Invite" : "Deactivate User"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "cancel"
                ? `${confirm.user.displayName || confirm.user.email} will lose this invite.`
                : `${confirm?.user.displayName || confirm?.user.email || "This user"} will be signed out until an owner reactivates them.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <SlideToDelete
              key={confirm?.user.id}
              pending={pending}
              onConfirm={() => {
                if (!confirm) return
                if (confirm.kind === "cancel") {
                  runUserAction(() => cancelInvite(confirm.user.id))
                  return
                }
                runUserAction(() => setUserActive(confirm.user.id, false))
              }}
              onCancel={() => {
                if (!pending) setConfirm(null)
              }}
            />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-medium tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function UserTable({
  users,
  templates,
  currentUserId,
  pending,
  onEdit,
  onResend,
  onCancel,
  onDeactivate,
  onReactivate,
}: {
  users: DirectoryUser[]
  templates: RoleTemplateOption[]
  currentUserId: string
  pending: boolean
  onEdit: (user: DirectoryUser) => void
  onResend: (user: DirectoryUser) => void
  onCancel: (user: DirectoryUser) => void
  onDeactivate: (user: DirectoryUser) => void
  onReactivate: (user: DirectoryUser) => void
}) {
  const labels = new Map(templates.map((template) => [template.key, template.label]))

  return (
    <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Login</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="py-8 text-center whitespace-normal text-muted-foreground">
                No Users Found.
              </TableCell>
            </TableRow>
          ) : (
            users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="whitespace-normal">
                  <span className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {initials(user.displayName, user.email)}
                    </span>
                    <span className="font-medium">{user.displayName || "—"}</span>
                  </span>
                </TableCell>
                <TableCell className="whitespace-normal">{user.email || "—"}</TableCell>
                <TableCell>
                  <Badge variant={roleVariant(user.role)} className={cn("rounded-full", roleClass(user.role))}>
                    {labels.get(user.role) ?? user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(user.status)} className="rounded-full">
                    {statusLabel(user.status)}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <LastLogin value={user.lastSignInAt} />
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="flex flex-wrap gap-1">
                    {user.status === "invited" ? (
                      <>
                        <Button type="button" variant="link" disabled={pending} onClick={() => onResend(user)}>
                          Resend Invite
                        </Button>
                          <Button
                            type="button"
                            variant="link"
                            className="text-destructive"
                            disabled={pending}
                            onClick={() => onCancel(user)}
                          >
                          Cancel Invite
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" variant="link" disabled={pending} onClick={() => onEdit(user)}>
                          Edit Access
                        </Button>
                        {user.id !== currentUserId ? (
                          <Button type="button" variant="link" disabled={pending} onClick={() => onEdit(user)}>
                            Change Role
                          </Button>
                        ) : null}
                        {user.id !== currentUserId && user.status === "active" ? (
                          <Button
                            type="button"
                            variant="link"
                            className="text-destructive"
                            disabled={pending}
                            onClick={() => onDeactivate(user)}
                          >
                            Deactivate
                          </Button>
                        ) : null}
                        {user.status === "deactivated" ? (
                          <Button type="button" variant="link" disabled={pending} onClick={() => onReactivate(user)}>
                            Reactivate
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function TemplateEditor({
  modules,
  templates,
  users,
}: {
  modules: ModuleOption[]
  templates: RoleTemplateOption[]
  users: DirectoryUser[]
}) {
  const [key, setKey] = useState(templates[0]?.key ?? "")
  const selected = templates.find((template) => template.key === key) ?? templates[0]
  const [showFinancials, setShowFinancials] = useState(selected?.showFinancials ?? false)
  const [matrix, setMatrix] = useState<PermissionMatrix>(selected?.permissions ?? {})
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function choose(nextKey: string) {
    const template = templates.find((item) => item.key === nextKey)
    if (!template) return
    setKey(nextKey)
    setShowFinancials(template.showFinancials)
    setMatrix(template.permissions)
    setError(null)
  }

  function toggle(module: string, field: keyof PermissionFlags, value: boolean) {
    setMatrix((current) => ({
      ...current,
      [module]: { ...(current[module] ?? emptyFlags()), [field]: value },
    }))
  }

  function save() {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      const result = await saveRoleTemplate(
        selected.id,
        showFinancials,
        modules.map((module) => ({
          module: module.key,
          ...(matrix[module.key] ?? emptyFlags()),
        })),
      )
      if (result.error) setError(result.error)
    })
  }

  if (!selected) {
    return <p className="text-sm text-muted-foreground">No Role Templates Yet.</p>
  }

  const count = users.filter((user) => user.role === selected.key).length

  return (
    <div className="flex flex-col gap-4">
      <RolePills templates={templates} value={selected.key} onChange={choose} />
      <p className="text-sm text-muted-foreground">
        {selected.label} · {count} {count === 1 ? "User" : "Users"}
      </p>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
        <Label htmlFor="template-financials">Show Financial Figures</Label>
        <AccessToggle
          checked={showFinancials}
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
        disabled={selected.key === "owner"}
        lockOwnersOnly={selected.key !== "owner"}
        onToggle={toggle}
      />
      <div className="flex justify-end">
        <Button type="button" disabled={pending} onClick={save}>
          Save Template
        </Button>
      </div>
    </div>
  )
}

function initials(name: string, email: string) {
  const source = name.trim() || email.trim()
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)
  return letters.toUpperCase() || "—"
}

function subscribeLastLogin() {
  return () => {}
}

function absoluteLastLogin(value: string | null) {
  if (!value) return "—"
  const day = value.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "—"
  return formatDayMonYear(day)
}

const relativeLastLogin = new Map<string, string>()

function snapshotLastLogin(value: string | null) {
  const key = value ?? ""
  const cached = relativeLastLogin.get(key)
  if (cached) return cached
  const next = relativeLabel(value)
  relativeLastLogin.set(key, next)
  return next
}

function relativeLabel(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`
  return formatDayMonYear(value.slice(0, 10))
}

function LastLogin({ value }: { value: string | null }) {
  const absolute = absoluteLastLogin(value)
  const label = useSyncExternalStore(
    subscribeLastLogin,
    () => snapshotLastLogin(value),
    () => absolute,
  )
  return <span>{label}</span>
}

function statusLabel(status: DirectoryUser["status"]) {
  if (status === "active") return "Active"
  if (status === "invited") return "Invited"
  return "Deactivated"
}

function statusVariant(status: DirectoryUser["status"]) {
  if (status === "deactivated") return "destructive" as const
  if (status === "invited") return "pending" as const
  return "default" as const
}

function roleVariant(role: string) {
  if (role === "staff") return "outline" as const
  if (role === "accountant" || role === "custom") return "secondary" as const
  return "default" as const
}

function roleClass(role: string) {
  if (role === "custom") return "bg-accent text-accent-foreground"
  return undefined
}
