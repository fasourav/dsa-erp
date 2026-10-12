"use client"

import { useActionState } from "react"

import { setPassword, type SetPasswordState } from "@/app/set-password/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: SetPasswordState = {}

const fieldClassName =
  "h-11 rounded-xl border-border/80 bg-background/45 px-3.5 shadow-sm backdrop-blur-md backdrop-saturate-150"

export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState(setPassword, initialState)
  const invalid = state.error ? true : undefined

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          aria-invalid={invalid}
          className={fieldClassName}
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
          aria-invalid={invalid}
          className={fieldClassName}
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-11 w-full rounded-xl border border-primary-foreground/20 bg-primary/85 shadow-md backdrop-blur-md hover:bg-primary/75"
      >
        {pending ? "Saving…" : "Set Password"}
      </Button>
    </form>
  )
}
