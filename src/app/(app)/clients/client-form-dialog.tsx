"use client"

import { savedToast } from "@/lib/saved"
import { useEffect, useRef, useState, useTransition } from "react"

import {
  addClient,
  updateClient,
  type ClientFormFieldErrors,
} from "@/app/(app)/clients/actions"
import { RecordAttachments } from "@/components/record-attachments"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PhoneInput } from "@/components/phone-input"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { ClientKind, ClientSummary } from "@/lib/client-summary"
import {
  escapeLikePattern,
  isValidEmail,
} from "@/lib/client-validation"
import { phoneErrorForStored } from "@/lib/phone"
import { createClient } from "@/lib/supabase/client"

const DUPLICATE_CHECK_DELAY_MS = 350

const NAME_DUPLICATE_MESSAGE =
  "A client with this name already exists."
const EMAIL_DUPLICATE_MESSAGE = "A client with this email already exists."

type KeyedCheck = {
  key: string
  message: string | null
}

const noCheck: KeyedCheck = { key: "", message: null }

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: ClientSummary | null
}) {
  const clientId = client?.id ?? null
  const [supabase] = useState(() => createClient())
  const [kind, setKind] = useState<ClientKind | null>(client?.kind ?? null)
  const [name, setName] = useState(client?.personName ?? "")
  const [company, setCompany] = useState(client?.companyName ?? "")
  const [email, setEmail] = useState(client?.email ?? "")
  const [phone, setPhone] = useState(client?.phone ?? "")
  const [address, setAddress] = useState(client?.address ?? "")
  const [notes, setNotes] = useState(client?.notes ?? "")

  const [attempted, setAttempted] = useState(false)
  const [nameCheck, setNameCheck] = useState<KeyedCheck>(noCheck)
  const [emailCheck, setEmailCheck] = useState<KeyedCheck>(noCheck)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const activeName = kind === "company" ? company : name
  const trimmedActiveName = activeName.trim()
  const trimmedEmail = email.trim()
  const trimmedPhone = phone.trim()

  const nameKey = trimmedActiveName ? trimmedActiveName.toLowerCase() : ""
  const nameRequest = useRef(0)
  const emailFormatError =
    trimmedEmail && !isValidEmail(trimmedEmail)
      ? "Enter a valid email address."
      : null
  const emailKey =
    trimmedEmail && !emailFormatError ? trimmedEmail.toLowerCase() : ""
  const phoneDigitError = phoneErrorForStored(trimmedPhone)

  const kindRequiredError =
    attempted && !kind ? "Choose Individual or Company." : null
  const nameRequiredError =
    attempted && kind && !trimmedActiveName
      ? kind === "company"
        ? "Enter the company name."
        : "Enter the client's name."
      : null
  const nameDuplicateError =
    nameKey && nameCheck.key === nameKey ? nameCheck.message : null
  const nameError = nameRequiredError ?? nameDuplicateError
  const emailDuplicateError =
    emailKey && emailCheck.key === emailKey ? emailCheck.message : null
  const emailError = emailFormatError ?? emailDuplicateError

  useEffect(() => {
    if (!open || !nameKey || !kind) {
      return
    }

    const request = nameRequest.current + 1
    nameRequest.current = request

    const timer = setTimeout(async () => {
      try {
        const pattern = escapeLikePattern(trimmedActiveName)
        let people = supabase
          .from("clients")
          .select("id")
          .ilike("person_name", pattern)
          .limit(1)
        let companies = supabase
          .from("clients")
          .select("id")
          .ilike("company_name", pattern)
          .limit(1)

        if (clientId) {
          people = people.neq("id", clientId)
          companies = companies.neq("id", clientId)
        }

        const [personResult, companyResult] = await Promise.all([people, companies])
        if (request !== nameRequest.current) return
        if (personResult.error || companyResult.error) return

        const duplicate =
          (personResult.data?.length ?? 0) > 0 || (companyResult.data?.length ?? 0) > 0

        setNameCheck({
          key: nameKey,
          message: duplicate ? NAME_DUPLICATE_MESSAGE : null,
        })
      } catch {
        // The server re-checks on save; a live-check network error isn't fatal.
      }
    }, DUPLICATE_CHECK_DELAY_MS)

    return () => clearTimeout(timer)
  }, [open, nameKey, kind, trimmedActiveName, clientId, supabase])

  useEffect(() => {
    if (!open || !emailKey) {
      return
    }

    const timer = setTimeout(async () => {
      try {
        let query = supabase
          .from("clients")
          .select("id")
          .ilike("email", escapeLikePattern(emailKey))
          .limit(1)

        if (clientId) {
          query = query.neq("id", clientId)
        }

        const { data, error } = await query

        if (error) {
          return
        }

        setEmailCheck({
          key: emailKey,
          message: data && data.length > 0 ? EMAIL_DUPLICATE_MESSAGE : null,
        })
      } catch {
        // The server re-checks on save; a live-check network error isn't fatal.
      }
    }, DUPLICATE_CHECK_DELAY_MS)

    return () => clearTimeout(timer)
  }, [open, emailKey, clientId, supabase])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) {
      return
    }

    onOpenChange(nextOpen)
  }

  function selectKind(next: ClientKind, checked: boolean) {
    setKind(checked ? next : null)
  }

  function handleSubmit() {
    setAttempted(true)
    setFormError(null)

    if (
      !kind ||
      !trimmedActiveName ||
      nameDuplicateError ||
      emailError ||
      phoneDigitError
    ) {
      return
    }

    const input = {
      kind,
      name: trimmedActiveName,
      email: trimmedEmail,
      phone: trimmedPhone,
      address: address.trim(),
      notes: notes.trim(),
    }

    startSubmit(async () => {
      try {
        const result = clientId
          ? await updateClient(clientId, input)
          : await addClient(input)

        if (result.fieldErrors) {
          applyFieldErrors(result.fieldErrors)
          return
        }

        if (result.error) {
          setFormError(result.error)
          return
        }

        savedToast()
        onOpenChange(false)
      } catch {
        setFormError("Could not save this client.")
      }
    })
  }

  function applyFieldErrors(fieldErrors: ClientFormFieldErrors) {
    if (fieldErrors.name && nameKey) {
      setNameCheck({ key: nameKey, message: fieldErrors.name })
    }
    if (fieldErrors.email && emailKey) {
      setEmailCheck({ key: emailKey, message: fieldErrors.email })
    }
    if (fieldErrors.phone) {
      setFormError(fieldErrors.phone)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="overflow-hidden sm:max-w-lg"
        mobileLayout="nav"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{clientId ? "Edit Client" : "Add New Client"}</DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {clientId ? <RecordAttachments parentType="client" parentId={clientId} /> : null}
          <FieldGroup layout="inset">
            <Field span="half" data-invalid={(kind !== "company" && Boolean(nameError)) || undefined}>
              <FieldLabel htmlFor="client-name">Name</FieldLabel>
              <Input
                id="client-name"
                value={name}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={kind !== "company" && Boolean(nameError)}
                onChange={(event) => setName(event.target.value)}
              />
              {kind !== "company" && nameError ? (
                <FieldError>{nameError}</FieldError>
              ) : null}
            </Field>

            <Field span="half" data-invalid={Boolean(kindRequiredError) || undefined}>
              <FieldTitle id="client-kind-label">Type</FieldTitle>
              <div
                role="group"
                aria-labelledby="client-kind-label"
                className="flex min-h-11 items-center gap-6 md:min-h-10.5"
              >
                <label className="flex min-h-11 items-center gap-2.5 text-base md:min-h-0 md:text-sm">
                  <Checkbox
                    checked={kind === "person"}
                    disabled={pending}
                    aria-invalid={Boolean(kindRequiredError)}
                    onCheckedChange={(checked) =>
                      selectKind("person", checked)
                    }
                  />
                  Individual
                </label>
                <label className="flex min-h-11 items-center gap-2.5 text-base md:min-h-0 md:text-sm">
                  <Checkbox
                    checked={kind === "company"}
                    disabled={pending}
                    aria-invalid={Boolean(kindRequiredError)}
                    onCheckedChange={(checked) =>
                      selectKind("company", checked)
                    }
                  />
                  Company
                </label>
              </div>
              {kindRequiredError ? <FieldError>{kindRequiredError}</FieldError> : null}
            </Field>

            {kind === "company" ? (
              <Field
                className="animate-in duration-200 fade-in-0 slide-in-from-top-1"
                data-invalid={Boolean(nameError) || undefined}
              >
                <FieldLabel htmlFor="client-company">Company</FieldLabel>
                <Input
                  id="client-company"
                  value={company}
                  autoComplete="organization"
                  enterKeyHint="next"
                  disabled={pending}
                  aria-invalid={Boolean(nameError)}
                  onChange={(event) => setCompany(event.target.value)}
                />
                {nameError ? <FieldError>{nameError}</FieldError> : null}
              </Field>
            ) : null}

            <Field span="half" data-invalid={Boolean(emailError) || undefined}>
              <FieldLabel htmlFor="client-email">Email</FieldLabel>
              <Input
                id="client-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                value={email}
                disabled={pending}
                aria-invalid={Boolean(emailError)}
                onChange={(event) => setEmail(event.target.value)}
              />
              {emailError ? <FieldError>{emailError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(phoneDigitError) || undefined}>
              <FieldLabel htmlFor="client-phone">Phone</FieldLabel>
              <PhoneInput
                id="client-phone"
                defaultValue={client?.phone ?? ""}
                disabled={pending}
                invalid={Boolean(phoneDigitError)}
                onChange={setPhone}
              />
              {phoneDigitError ? <FieldError>{phoneDigitError}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="client-address">Address</FieldLabel>
              <Textarea
                id="client-address"
                value={address}
                autoComplete="street-address"
                disabled={pending}
                onChange={(event) => setAddress(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="client-notes">Notes</FieldLabel>
              <Textarea
                id="client-notes"
                value={notes}
                disabled={pending}
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </FieldGroup>

          {formError ? (
            <p role="alert" className="px-1 text-sm text-destructive md:px-0">
              {formError}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline" disabled={pending} />
            }
          >
            Cancel
          </DialogClose>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Saving…" : clientId ? "Save Changes" : "Save Client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
