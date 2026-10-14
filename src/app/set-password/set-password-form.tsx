"use client"

import { LockKeyhole } from "lucide-react"
import { useActionState } from "react"

import {
  authAlertClassName,
  authGroupClassName,
  authIconClassName,
  authInputClassName,
  authLabelClassName,
  authSubmitClassName,
} from "@/app/login/auth-styles"
import { setPassword, type SetPasswordState } from "@/app/set-password/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

const initialState: SetPasswordState = {}

export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState(setPassword, initialState)
  const invalid = state.error ? true : undefined

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <FieldGroup className="gap-3">
        <Field>
          <FieldLabel htmlFor="password" className={authLabelClassName}>
            Password
          </FieldLabel>
          <InputGroup className={authGroupClassName}>
            <InputGroupAddon className={authIconClassName}>
              <LockKeyhole aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              enterKeyHint="next"
              minLength={10}
              required
              aria-invalid={invalid}
              className={authInputClassName}
            />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password" className={authLabelClassName}>
            Confirm Password
          </FieldLabel>
          <InputGroup className={authGroupClassName}>
            <InputGroupAddon className={authIconClassName}>
              <LockKeyhole aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              enterKeyHint="go"
              minLength={10}
              required
              aria-invalid={invalid}
              className={authInputClassName}
            />
          </InputGroup>
        </Field>
      </FieldGroup>
      {state.error ? (
        <p role="alert" className={authAlertClassName}>
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className={authSubmitClassName}>
        {pending ? "Saving…" : "Set Password"}
      </Button>
    </form>
  )
}
