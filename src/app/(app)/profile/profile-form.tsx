"use client"

import { useActionState, useEffect, useRef } from "react"

import {
  changePassword,
  updateDisplayName,
  type ProfileState,
} from "@/app/(app)/profile/actions"
import { Button } from "@/components/ui/button"
import { savedToast } from "@/lib/saved"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { accountInitials } from "@/lib/account-identity"

const initialState: ProfileState = {}

export function ProfileForm({
  name,
  email,
  roleLabel,
  designation,
}: {
  name: string
  email: string
  roleLabel: string
  designation: string | null
}) {
  const [nameState, nameAction, namePending] = useActionState(updateDisplayName, initialState)
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePassword,
    initialState,
  )
  const seenName = useRef(nameState)
  const seenPassword = useRef(passwordState)

  useEffect(() => {
    if (nameState.saved && seenName.current !== nameState) savedToast("Name Saved")
    seenName.current = nameState
  }, [nameState])

  useEffect(() => {
    if (passwordState.saved && seenPassword.current !== passwordState) {
      savedToast("Password Changed")
    }
    seenPassword.current = passwordState
  }, [passwordState])

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-avatar text-base font-semibold text-on-color">
            {accountInitials(name, email)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-ui font-semibold">{name || "—"}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant={roleBadgeVariant(roleLabel)}>{roleLabel}</Badge>
              {designation ? (
                <span className="text-sm text-muted-foreground">{designation}</span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <form action={nameAction}>
        <Card>
          <CardHeader>
            <CardTitle>Name</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup layout="inset">
              <Field>
                <FieldLabel htmlFor="display-name">Full Name</FieldLabel>
                <Input
                  id="display-name"
                  name="displayName"
                  defaultValue={name}
                  autoComplete="name"
                  autoCapitalize="words"
                  enterKeyHint="done"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="profile-email">Email</FieldLabel>
                <Input
                  id="profile-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  readOnly
                />
              </Field>
            </FieldGroup>
            {nameState.error ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {nameState.error}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={namePending}>
              {namePending ? "Saving…" : "Save Name"}
            </Button>
          </CardFooter>
        </Card>
      </form>

      <form action={passwordAction}>
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup layout="inset">
              <Field>
                <FieldLabel htmlFor="new-password">New Password</FieldLabel>
                <Input
                  id="new-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  enterKeyHint="next"
                  minLength={10}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  enterKeyHint="done"
                  minLength={10}
                  required
                />
              </Field>
            </FieldGroup>
            {passwordState.error ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {passwordState.error}
              </p>
            ) : null}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={passwordPending}>
              {passwordPending ? "Saving…" : "Change Password"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  )
}

function roleBadgeVariant(roleLabel: string) {
  switch (roleLabel.trim().toLowerCase()) {
    case "owner":
      return "violet" as const
    case "custom":
      return "warning" as const
    case "accountant":
      return "info" as const
    case "staff":
      return "neutral" as const
    default:
      return "outline" as const
  }
}
