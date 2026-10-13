"use client"

import { useActionState, useEffect, useRef } from "react"

import {
  changePassword,
  updateDisplayName,
  type ProfileState,
} from "@/app/(app)/profile/actions"
import { Button } from "@/components/ui/button"
import { savedToast } from "@/lib/saved"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
        <CardHeader>
          <CardTitle>Name</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={nameAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="display-name">Full Name</Label>
              <Input
                id="display-name"
                name="displayName"
                defaultValue={name}
                autoComplete="name"
                required
              />
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Email</span>
              <span>{email || "—"}</span>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">Role</span>
              <span>{roleLabel}</span>
            </div>
            {designation ? (
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-muted-foreground">Designation</span>
                <span>{designation}</span>
              </div>
            ) : null}
            {nameState.error ? (
              <p role="alert" className="text-sm text-destructive">
                {nameState.error}
              </p>
            ) : null}
            <Button type="submit" disabled={namePending}>
              {namePending ? "Saving…" : "Save Name"}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={passwordAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
              />
            </div>
            {passwordState.error ? (
              <p role="alert" className="text-sm text-destructive">
                {passwordState.error}
              </p>
            ) : null}
            <Button type="submit" disabled={passwordPending}>
              {passwordPending ? "Saving…" : "Change Password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
