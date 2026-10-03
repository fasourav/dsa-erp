"use client"

import { Plus } from "lucide-react"
import { useEffect, useState, useTransition } from "react"

import { addClient, type AddClientFieldErrors } from "@/app/(app)/clients/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ClientKind } from "@/lib/client-summary"
import {
  escapeLikePattern,
  hasMinDigits,
  isValidEmail,
  normalizePhoneDigits,
} from "@/lib/client-validation"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

const DUPLICATE_CHECK_DELAY_MS = 350

const NAME_DUPLICATE_MESSAGE =
  "A client with this name and phone already exists."
const EMAIL_DUPLICATE_MESSAGE = "A client with this email already exists."

type KeyedCheck = {
  key: string
  message: string | null
}

const noCheck: KeyedCheck = { key: "", message: null }

export function AddClientDialog() {
  const [supabase] = useState(() => createClient())
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ClientKind | null>(null)
  const [name, setName] = useState("")
  const [company, setCompany] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [notes, setNotes] = useState("")

  const [attempted, setAttempted] = useState(false)
  const [nameCheck, setNameCheck] = useState<KeyedCheck>(noCheck)
  const [emailCheck, setEmailCheck] = useState<KeyedCheck>(noCheck)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const activeName = kind === "company" ? company : name
  const trimmedActiveName = activeName.trim()
  const trimmedEmail = email.trim()
  const trimmedPhone = phone.trim()

  const nameKey = kind && trimmedActiveName
    ? `${kind}|${trimmedActiveName.toLowerCase()}|${normalizePhoneDigits(trimmedPhone)}`
    : ""
  const emailFormatError =
    trimmedEmail && !isValidEmail(trimmedEmail)
      ? "Enter a valid email address."
      : null
  const emailKey = trimmedEmail && !emailFormatError ? trimmedEmail.toLowerCase() : ""
  const phoneDigitError =
    trimmedPhone && !hasMinDigits(trimmedPhone, 11)
      ? "Enter a phone number with at least 11 digits."
      : null

  const kindRequiredError =
    attempted && !kind ? "Choose Individual or Company." : null
  const nameRequiredError =
    attempted && kind && !trimmedActiveName
      ? kind === "company"
        ? "Enter the company name."
        : "Enter the client's name."
      : null
  const nameDuplicateError = nameKey && nameCheck.key === nameKey ? nameCheck.message : null
  const nameError = nameRequiredError ?? nameDuplicateError
  const emailDuplicateError =
    emailKey && emailCheck.key === emailKey ? emailCheck.message : null
  const emailError = emailFormatError ?? emailDuplicateError

  useEffect(() => {
    if (!open || !nameKey) {
      return
    }

    const timer = setTimeout(async () => {
      try {
        const column = kind === "company" ? "company_name" : "person_name"
        const { data, error } = await supabase
          .from("clients")
          .select("person_name, company_name, phone")
          .eq("kind", kind as ClientKind)
          .ilike(column, escapeLikePattern(trimmedActiveName))

        if (error) {
          return
        }

        const normalizedPhone = normalizePhoneDigits(trimmedPhone)
        const duplicate = (data ?? []).some((row) => {
          const rowPhone = row.phone?.trim() ?? ""
          if (!normalizedPhone) {
            return rowPhone === ""
          }
          return (
            rowPhone !== "" &&
            normalizePhoneDigits(rowPhone) === normalizedPhone
          )
        })

        setNameCheck({
          key: nameKey,
          message: duplicate ? NAME_DUPLICATE_MESSAGE : null,
        })
      } catch {
        // The server re-checks on save; a live-check network error isn't fatal.
      }
    }, DUPLICATE_CHECK_DELAY_MS)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kind and trimmedActiveName are encoded in nameKey
  }, [open, nameKey, trimmedPhone, supabase])

  useEffect(() => {
    if (!open || !emailKey) {
      return
    }

    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from("clients")
          .select("id")
          .ilike("email", escapeLikePattern(emailKey))
          .limit(1)

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
  }, [open, emailKey, supabase])

  function resetForm() {
    setKind(null)
    setName("")
    setCompany("")
    setEmail("")
    setPhone("")
    setNotes("")
    setAttempted(false)
    setNameCheck(noCheck)
    setEmailCheck(noCheck)
    setFormError(null)
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) {
      return
    }

    setOpen(nextOpen)
    if (!nextOpen) {
      resetForm()
    }
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

    startSubmit(async () => {
      try {
        const result = await addClient({
          kind,
          name: trimmedActiveName,
          email: trimmedEmail,
          phone: trimmedPhone,
          notes: notes.trim(),
        })

        if (result.fieldErrors) {
          applyFieldErrors(result.fieldErrors)
          return
        }

        if (result.error) {
          setFormError(result.error)
          return
        }

        handleOpenChange(false)
      } catch {
        setFormError("Could not save this client.")
      }
    })
  }

  function applyFieldErrors(fieldErrors: AddClientFieldErrors) {
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
      <DialogTrigger render={<Button type="button" />}>
        <Plus aria-hidden="true" data-icon="inline-start" />
        Add New Client
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Add new client</DialogTitle>
          <DialogDescription>
            Individual and Company clients are stored with different name
            fields.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="client-name">Name</Label>
              <Input
                id="client-name"
                value={name}
                disabled={pending}
                aria-invalid={kind !== "company" && Boolean(nameError)}
                onChange={(event) => setName(event.target.value)}
              />
              {kind !== "company" && nameError ? (
                <p role="alert" className="text-sm text-destructive">
                  {nameError}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Type</span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
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
                <label className="flex items-center gap-2 text-sm">
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
              {kindRequiredError ? (
                <p role="alert" className="text-sm text-destructive">
                  {kindRequiredError}
                </p>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              "grid transition-all duration-200 ease-out",
              kind === "company"
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0",
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-col gap-2 pt-1">
                <Label htmlFor="client-company">Company</Label>
                <Input
                  id="client-company"
                  value={company}
                  disabled={pending || kind !== "company"}
                  tabIndex={kind === "company" ? undefined : -1}
                  aria-invalid={kind === "company" && Boolean(nameError)}
                  onChange={(event) => setCompany(event.target.value)}
                />
                {kind === "company" && nameError ? (
                  <p role="alert" className="text-sm text-destructive">
                    {nameError}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="client-email">Email</Label>
              <Input
                id="client-email"
                type="email"
                value={email}
                disabled={pending}
                aria-invalid={Boolean(emailError)}
                onChange={(event) => setEmail(event.target.value)}
              />
              {emailError ? (
                <p role="alert" className="text-sm text-destructive">
                  {emailError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="client-phone">Phone</Label>
              <Input
                id="client-phone"
                type="tel"
                value={phone}
                disabled={pending}
                aria-invalid={Boolean(phoneDigitError)}
                onChange={(event) => setPhone(event.target.value)}
              />
              {phoneDigitError ? (
                <p role="alert" className="text-sm text-destructive">
                  {phoneDigitError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="client-notes">Notes</Label>
            <Textarea
              id="client-notes"
              value={notes}
              disabled={pending}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose
            render={<Button type="button" variant="outline" disabled={pending} />}
          >
            Cancel
          </DialogClose>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Saving…" : "Save client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
