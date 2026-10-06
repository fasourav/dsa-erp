"use client"

import { useState, useTransition } from "react"

import { updateUserRole } from "@/app/(app)/settings/users/actions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ProfileRow } from "@/lib/profiles"

const roleItems = [
  { value: "owner", label: "Owner" },
  { value: "accountant", label: "Accountant" },
  { value: "staff", label: "Staff" },
]

export function UsersPanel({
  profiles,
  error,
}: {
  profiles: ProfileRow[]
  error: string | null
}) {
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleRoleChange(userId: string, role: string) {
    setUpdateError(null)
    startTransition(async () => {
      try {
        const result = await updateUserRole(userId, role)
        if (result.error) setUpdateError(result.error)
      } catch {
        setUpdateError("Could not update role.")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-medium tracking-tight">Users & Roles</h1>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {updateError ? (
        <p role="alert" className="text-sm text-destructive">
          {updateError}
        </p>
      ) : null}

      <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={2}
                  className="py-8 text-center whitespace-normal text-muted-foreground"
                >
                  No Users Found.
                </TableCell>
              </TableRow>
            ) : (
              profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">
                    {profile.displayName || profile.id.slice(0, 8)}
                  </TableCell>
                  <TableCell>
                    <Select
                      items={roleItems}
                      value={profile.role}
                      disabled={pending}
                      onValueChange={(v) => {
                        if (v) handleRoleChange(profile.id, v)
                      }}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent align="start">
                        {roleItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
