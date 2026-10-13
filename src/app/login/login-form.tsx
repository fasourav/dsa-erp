"use client"

import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react"
import { useActionState, useState } from "react"

import { signIn, type SignInState } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  authAlertClassName,
  authGroupClassName as groupClassName,
  authIconClassName as iconClassName,
  authInputClassName as inputClassName,
  authLabelClassName as labelClassName,
  authSubmitClassName,
} from "@/app/login/auth-styles"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

const initialState: SignInState = {}

export function LoginForm({ notice }: { notice?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <form action={formAction} className="flex w-full flex-col">
      <FieldGroup layout="inset" className="md:gap-3.5">
        <Field>
          <FieldLabel htmlFor="email" className={labelClassName}>
            Email
          </FieldLabel>
          <InputGroup className={groupClassName}>
            <InputGroupAddon className={iconClassName}>
              <Mail aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="next"
              required
              aria-invalid={state.error ? true : undefined}
              className={inputClassName}
            />
          </InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor="password" className={labelClassName}>
            Password
          </FieldLabel>
          <InputGroup className={groupClassName}>
            <InputGroupAddon className={iconClassName}>
              <LockKeyhole aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              enterKeyHint="go"
              required
              aria-invalid={state.error ? true : undefined}
              className={inputClassName}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-sm"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="text-subtle-foreground hover:bg-fill md:text-login-field-icon md:hover:bg-login-field"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </Field>
      </FieldGroup>
      {[notice, state.error].filter(Boolean).map((message) => (
        <p
          key={message}
          role="alert"
          className={authAlertClassName}
        >
          {message}
        </p>
      ))}
      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className={authSubmitClassName}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  )
}
