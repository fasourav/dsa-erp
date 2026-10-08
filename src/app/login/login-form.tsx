"use client"

import { useActionState } from "react"

import { signIn, type SignInState } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: SignInState = {}

const fieldClassName =
  "h-11 rounded-xl border-border/80 bg-background/45 px-3.5 shadow-sm backdrop-blur-md backdrop-saturate-150"

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          required
          aria-invalid={state.error ? true : undefined}
          className={fieldClassName}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={state.error ? true : undefined}
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
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
