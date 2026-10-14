"use client"

import { ListExport } from "@/components/list-export"
import { savedToast } from "@/lib/saved"
import { MoreHorizontal } from "lucide-react"
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
import { DataList } from "@/components/data-list"
import { ListSearch } from "@/components/list-search"
import { PageHeader } from "@/components/page-header"
import { StatusBadge } from "@/components/status-badge"
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
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDayMonYear } from "@/lib/format"
import {
  paginateRows,
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"

const tabs = [
  { id: "users", label: "Users" },
  { id: "templates", label: "Role Templates" },
  { id: "pending", label: "Pending Invites" },
] as const

type TabId = (typeof tabs)[number]["id"]

type UserColumn =
  | "displayName"
  | "email"
  | "role"
  | "designation"
  | "status"
  | "lastLogin"

const userColumns: readonly ListColumn<UserColumn>[] = [
  { id: "displayName", label: "Name", align: "left", locked: true },
  { id: "email", label: "Email", align: "left", locked: true },
  { id: "role", label: "Role", align: "left", locked: true },
  { id: "designation", label: "Designation", align: "left", locked: true },
  { id: "status", label: "Status", align: "left", locked: true },
  { id: "lastLogin", label: "Last Login", align: "left", locked: true },
]

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

  const searched = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return users
    return users.filter((user) =>
      `${user.displayName} ${user.designation} ${user.email}`.toLowerCase().includes(needle),
    )
  }, [query, users])
  const pendingUsers = useMemo(
    () => searched.filter((user) => user.status === "invited"),
    [searched],
  )

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

  const exportRows = tab === "pending" ? pendingUsers : searched

  return (
    <div className="flex flex-col gap-3.5">
      <PageHeader
        eyebrow="Admin"
        title="Users & Permissions"
        className="mb-0 md:mb-2"
        actions={
          tab === "templates" ? null : (
            <>
              <ListExport
                grid={{
                  filename: "users",
                  title: "Users",
                  columns: [
                    { header: "Name", kind: "text" },
                    { header: "Email", kind: "text" },
                    { header: "Role", kind: "text" },
                    { header: "Designation", kind: "text" },
                    { header: "Status", kind: "text" },
                    { header: "Last Login", kind: "text" },
                  ],
                  rows: exportRows.map((user) => [
                    user.displayName || "—",
                    user.email || "—",
                    templates.find((template) => template.key === user.role)?.label ?? user.role,
                    user.designation || "—",
                    statusLabel(user.status),
                    absoluteLastLogin(user.lastSignInAt),
                  ]),
                }}
              />
              {tab === "users" ? (
                <Button type="button" onClick={openInvite}>
                  Invite User
                </Button>
              ) : null}
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-4">
        <Stat label="Total Users" value={counts.total} />
        <Stat label="Active" value={counts.active} />
        <Stat label="Pending Invites" value={counts.pending} />
        <Stat label="Deactivated" value={counts.deactivated} />
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

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (value === "users" || value === "templates" || value === "pending") {
            setTab(value)
          }
        }}
      >
        <TabsList>
          {tabs.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="users" className="flex flex-col gap-3.5">
          <ListSearch
            query={query}
            onQueryChange={setQuery}
            placeholder="Search users"
          />
          <UserList
            key={query}
            users={error ? [] : searched}
            templates={templates}
            currentUserId={currentUserId}
            error={error}
            pending={pending}
            onEdit={openEdit}
            onResend={(user) => runUserAction(() => resendInvite(user.id))}
            onCancel={(user) => setConfirm({ kind: "cancel", user })}
            onDeactivate={(user) => setConfirm({ kind: "deactivate", user })}
            onReactivate={(user) => runUserAction(() => setUserActive(user.id, true))}
          />
          <Card>
            <CardHeader>
              <CardTitle>Role Templates</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {templates.map((template) => {
                  const count = users.filter((user) => user.role === template.key).length
                  return (
                    <Badge key={template.id} variant={roleBadgeVariant(template.key)}>
                      {template.label} · {count} {count === 1 ? "User" : "Users"}
                    </Badge>
                  )
                })}
              </div>
            </CardContent>
            <CardFooter className="justify-end">
              <Button type="button" variant="outline" onClick={() => setTab("templates")}>
                Edit Templates
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="pending">
          <UserList
            key={query}
            users={error ? [] : pendingUsers}
            templates={templates}
            currentUserId={currentUserId}
            error={error}
            pending={pending}
            onEdit={openEdit}
            onResend={(user) => runUserAction(() => resendInvite(user.id))}
            onCancel={(user) => setConfirm({ kind: "cancel", user })}
            onDeactivate={(user) => setConfirm({ kind: "deactivate", user })}
            onReactivate={(user) => runUserAction(() => setUserActive(user.id, true))}
          />
        </TabsContent>

        <TabsContent value="templates">
          <TemplateEditor modules={modules} templates={templates} users={users} />
        </TabsContent>
      </Tabs>

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
        <p className="text-label text-muted-foreground">{label}</p>
        <p className="text-metric tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function UserList({
  users,
  templates,
  currentUserId,
  error,
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
  error: string | null
  pending: boolean
  onEdit: (user: DirectoryUser) => void
  onResend: (user: DirectoryUser) => void
  onCancel: (user: DirectoryUser) => void
  onDeactivate: (user: DirectoryUser) => void
  onReactivate: (user: DirectoryUser) => void
}) {
  const labels = new Map(templates.map((template) => [template.key, template.label]))
  const [sort, setSort] = useState<SortState<UserColumn>>({
    key: "displayName",
    direction: "asc",
  })
  const [page, setPage] = useState(1)
  const sorted = useMemo(() => sortUsers(users, sort), [sort, users])
  const pageResult = paginateRows(sorted, page)

  return (
    <DataList
      columns={userColumns}
      rows={pageResult.rows}
      rowKey={(user) => user.id}
      sort={sort}
      onSort={(key) => {
        setSort((current) => toggleSort(current, key))
        setPage(1)
      }}
      visibility={{}}
      error={error}
      emptyMessage="No Users Found."
      rangeText={rangeLabel(
        pageResult.rangeStart,
        pageResult.rangeEnd,
        error ? 0 : pageResult.total,
        "user",
        "users",
      )}
      currentPage={pageResult.currentPage}
      pageCount={pageResult.pageCount}
      onPageChange={setPage}
      pagingLabel="Users pagination"
      mobileItem={(user) => ({
        title: user.displayName || "—",
        subtitle: user.email || "—",
        value: (
          <Badge variant={roleBadgeVariant(user.role)}>
            {labels.get(user.role) ?? user.role}
          </Badge>
        ),
        meta: <StatusBadge status={user.status} />,
      })}
      renderCell={(user, columnId) => {
        switch (columnId) {
          case "displayName":
            return <span className="text-ui font-semibold">{user.displayName || "—"}</span>
          case "email":
            return user.email ? (
              <span>{user.email}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          case "role":
            return (
              <Badge variant={roleBadgeVariant(user.role)}>
                {labels.get(user.role) ?? user.role}
              </Badge>
            )
          case "designation":
            return user.designation ? (
              <Badge variant="outline">{user.designation}</Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            )
          case "status":
            return <StatusBadge status={user.status} />
          case "lastLogin":
            return <LastLogin value={user.lastSignInAt} />
        }
      }}
      renderActions={(user) => (
        <UserActions
          user={user}
          currentUserId={currentUserId}
          pending={pending}
          onEdit={onEdit}
          onResend={onResend}
          onCancel={onCancel}
          onDeactivate={onDeactivate}
          onReactivate={onReactivate}
        />
      )}
    />
  )
}

function sortUsers(rows: DirectoryUser[], sort: SortState<UserColumn>) {
  const sorted = [...rows]
  sorted.sort((left, right) => {
    let cmp = 0
    switch (sort.key) {
      case "displayName":
        cmp = left.displayName.localeCompare(right.displayName, "en", { sensitivity: "base" })
        break
      case "email":
        cmp = left.email.localeCompare(right.email, "en", { sensitivity: "base" })
        break
      case "role":
        cmp = left.role.localeCompare(right.role, "en", { sensitivity: "base" })
        break
      case "designation":
        cmp = left.designation.localeCompare(right.designation, "en", { sensitivity: "base" })
        break
      case "status":
        cmp = left.status.localeCompare(right.status)
        break
      case "lastLogin":
        cmp = (left.lastSignInAt ?? "").localeCompare(right.lastSignInAt ?? "")
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })
  return sorted
}

function UserActions({
  user,
  currentUserId,
  pending,
  onEdit,
  onResend,
  onCancel,
  onDeactivate,
  onReactivate,
}: {
  user: DirectoryUser
  currentUserId: string
  pending: boolean
  onEdit: (user: DirectoryUser) => void
  onResend: (user: DirectoryUser) => void
  onCancel: (user: DirectoryUser) => void
  onDeactivate: (user: DirectoryUser) => void
  onReactivate: (user: DirectoryUser) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Actions for ${user.displayName || user.email || "user"}`}
            disabled={pending}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {user.status === "invited" ? (
          <>
            <DropdownMenuItem disabled={pending} onClick={() => onResend(user)}>
              Resend Invite
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={pending} onClick={() => onCancel(user)}>
              Cancel Invite
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <DropdownMenuItem disabled={pending} onClick={() => onEdit(user)}>
              Edit Access
            </DropdownMenuItem>
            {user.id !== currentUserId ? (
              <DropdownMenuItem disabled={pending} onClick={() => onEdit(user)}>
                Change Role
              </DropdownMenuItem>
            ) : null}
            {user.id !== currentUserId && user.status === "active" ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  disabled={pending}
                  onClick={() => onDeactivate(user)}
                >
                  Deactivate
                </DropdownMenuItem>
              </>
            ) : null}
            {user.status === "deactivated" ? (
              <DropdownMenuItem disabled={pending} onClick={() => onReactivate(user)}>
                Reactivate
              </DropdownMenuItem>
            ) : null}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
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
    <Card>
      <CardHeader>
        <CardTitle>{selected.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <RolePills templates={templates} value={selected.key} onChange={choose} />
        <p className="text-sm text-muted-foreground">
          {selected.label} · {count} {count === 1 ? "User" : "Users"}
        </p>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <Label htmlFor="template-financials">Show Financial Figures</Label>
          <AccessToggle
            checked={showFinancials}
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
          disabled={selected.key === "owner"}
          lockOwnersOnly={selected.key !== "owner"}
          onToggle={toggle}
        />
      </CardContent>
      <CardFooter className="justify-end">
        <Button type="button" disabled={pending} onClick={save}>
          Save Template
        </Button>
      </CardFooter>
    </Card>
  )
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

function roleBadgeVariant(role: string) {
  if (role === "owner") return "violet" as const
  if (role === "custom") return "warning" as const
  if (role === "accountant") return "info" as const
  if (role === "staff") return "neutral" as const
  return "outline" as const
}
