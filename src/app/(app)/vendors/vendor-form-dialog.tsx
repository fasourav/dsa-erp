"use client"

import { useEffect, useState, useTransition } from "react"

import {
  addVendor,
  loadVendorCategoryOptions,
  updateVendor,
  type VendorFormFieldErrors,
} from "@/app/(app)/vendors/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  escapeLikePattern,
  hasMinDigits,
  isValidEmail,
  normalizePhoneDigits,
} from "@/lib/client-validation"
import { createClient } from "@/lib/supabase/client"
import type { VendorKind, VendorSummary } from "@/lib/vendor-summary"

const DUPLICATE_CHECK_DELAY_MS = 350

const NAME_DUPLICATE_MESSAGE =
  "A vendor with this name and phone already exists."

type KeyedCheck = {
  key: string
  message: string | null
}

const noCheck: KeyedCheck = { key: "", message: null }

export function VendorFormDialog({
  open,
  onOpenChange,
  vendor,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vendor: VendorSummary | null
  categories: readonly string[]
}) {
  const vendorId = vendor?.id ?? null
  const [supabase] = useState(() => createClient())
  const [kind, setKind] = useState<VendorKind | null>(vendor?.kind ?? null)
  const [personName, setPersonName] = useState(vendor?.personName ?? "")
  const [companyName, setCompanyName] = useState(vendor?.companyName ?? "")
  const [category, setCategory] = useState(vendor?.vendorField ?? "")
  const [categoryOptions, setCategoryOptions] = useState<string[]>(() => [
    ...categories,
  ])
  const [email, setEmail] = useState(vendor?.email ?? "")
  const [phone, setPhone] = useState(vendor?.phone ?? "")
  const [notes, setNotes] = useState(vendor?.notes ?? "")

  const [attempted, setAttempted] = useState(false)
  const [nameCheck, setNameCheck] = useState<KeyedCheck>(noCheck)
  const [serverKindError, setServerKindError] = useState<string | null>(null)
  const [serverEmailError, setServerEmailError] = useState<string | null>(null)
  const [serverPhoneError, setServerPhoneError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const activeName = kind === "company" ? companyName : personName
  const trimmedActiveName = activeName.trim()
  const trimmedEmail = email.trim()
  const trimmedPhone = phone.trim()

  const nameKey =
    kind && trimmedActiveName
      ? `${kind}|${trimmedActiveName.toLowerCase()}|${normalizePhoneDigits(trimmedPhone)}`
      : ""
  const emailFormatError =
    trimmedEmail && !isValidEmail(trimmedEmail)
      ? "Enter a valid email address."
      : null
  const phoneDigitError =
    trimmedPhone && !hasMinDigits(trimmedPhone, 11)
      ? "Enter a phone number with at least 11 digits."
      : null

  const kindRequiredError =
    (attempted && !kind ? "Choose Private or Company." : null) ??
    serverKindError
  const nameRequiredError =
    attempted && kind && !trimmedActiveName
      ? kind === "company"
        ? "Enter the company name."
        : "Enter the vendor name."
      : null
  const nameDuplicateError =
    nameKey && nameCheck.key === nameKey ? nameCheck.message : null
  const nameError = nameRequiredError ?? nameDuplicateError
  const emailError = emailFormatError ?? serverEmailError
  const phoneError = phoneDigitError ?? serverPhoneError

  useEffect(() => {
    if (!open) {
      return
    }

    let cancelled = false

    async function loadCategories() {
      try {
        const result = await loadVendorCategoryOptions()

        if (!cancelled && result.categories !== null) {
          setCategoryOptions(result.categories)
        }
      } catch {
        // Keep the list from the page if this refresh fails.
      }
    }

    void loadCategories()

    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !nameKey || !kind) {
      return
    }

    const timer = setTimeout(async () => {
      try {
        const column = kind === "company" ? "company_name" : "person_name"
        let query = supabase
          .from("vendors")
          .select("phone")
          .eq("kind", kind)
          .ilike(column, escapeLikePattern(trimmedActiveName))

        if (vendorId) {
          query = query.neq("id", vendorId)
        }

        const { data, error } = await query

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
  }, [open, nameKey, kind, trimmedActiveName, trimmedPhone, vendorId, supabase])

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) {
      return
    }

    onOpenChange(nextOpen)
  }

  function selectKind(next: VendorKind, checked: boolean) {
    setServerKindError(null)
    setKind(checked ? next : null)
  }

  function handleCategoryInput(
    next: string,
    details: { reason: string; cancel: () => void },
  ) {
    if (details.reason === "input-change" || details.reason === "item-press") {
      setCategory(next)
      return
    }

    // Closing the list snaps unmatched text back to the last picked item.
    // Vendor Category may be new text, so keep what was typed.
    details.cancel()
  }

  function handleSubmit() {
    setAttempted(true)
    setFormError(null)
    setServerKindError(null)
    setServerEmailError(null)
    setServerPhoneError(null)

    if (
      !kind ||
      !trimmedActiveName ||
      nameDuplicateError ||
      emailFormatError ||
      phoneDigitError
    ) {
      return
    }

    const input = {
      kind,
      name: trimmedActiveName,
      vendorField: category.trim(),
      email: trimmedEmail,
      phone: trimmedPhone,
      notes: notes.trim(),
    }

    startSubmit(async () => {
      try {
        const result = vendorId
          ? await updateVendor(vendorId, input)
          : await addVendor(input)

        if (result.fieldErrors) {
          applyFieldErrors(result.fieldErrors)
          return
        }

        if (result.error) {
          setFormError(result.error)
          return
        }

        onOpenChange(false)
      } catch {
        setFormError("Could not save this vendor.")
      }
    })
  }

  function applyFieldErrors(fieldErrors: VendorFormFieldErrors) {
    if (fieldErrors.kind) {
      setServerKindError(fieldErrors.kind)
    }
    if (fieldErrors.name && nameKey) {
      setNameCheck({ key: nameKey, message: fieldErrors.name })
    }
    if (fieldErrors.email) {
      setServerEmailError(fieldErrors.email)
    }
    if (fieldErrors.phone) {
      setServerPhoneError(fieldErrors.phone)
    }
  }

  const nameField =
    kind === "company"
      ? {
          id: "vendor-company",
          label: "Vendor Company",
          value: companyName,
          onChange: setCompanyName,
        }
      : {
          id: "vendor-name",
          label: "Vendor Name",
          value: personName,
          onChange: setPersonName,
        }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>
            {vendorId ? "Edit vendor" : "Add New Vendor"}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Vendor Type</span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={kind === "private"}
                  disabled={pending}
                  aria-invalid={Boolean(kindRequiredError)}
                  onCheckedChange={(checked) =>
                    selectKind("private", checked === true)
                  }
                />
                Private
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={kind === "company"}
                  disabled={pending}
                  aria-invalid={Boolean(kindRequiredError)}
                  onCheckedChange={(checked) =>
                    selectKind("company", checked === true)
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

          {kind ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor={nameField.id}>{nameField.label}</Label>
              <Input
                id={nameField.id}
                value={nameField.value}
                disabled={pending}
                aria-invalid={Boolean(nameError)}
                onChange={(event) => nameField.onChange(event.target.value)}
              />
              {nameError ? (
                <p role="alert" className="text-sm text-destructive">
                  {nameError}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <Label htmlFor="vendor-category">Vendor Category</Label>
            <Combobox
              autoComplete="off"
              items={categoryOptions}
              inputValue={category}
              onInputValueChange={handleCategoryInput}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  setCategory(value)
                }
              }}
            >
              <ComboboxInput
                id="vendor-category"
                className="w-full"
                disabled={pending}
              />
              <ComboboxContent className="data-empty:hidden">
                <ComboboxList>
                  {(item: string) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-email">Email</Label>
              <Input
                id="vendor-email"
                type="email"
                value={email}
                disabled={pending}
                aria-invalid={Boolean(emailError)}
                onChange={(event) => {
                  setServerEmailError(null)
                  setEmail(event.target.value)
                }}
              />
              {emailError ? (
                <p role="alert" className="text-sm text-destructive">
                  {emailError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input
                id="vendor-phone"
                type="tel"
                value={phone}
                disabled={pending}
                aria-invalid={Boolean(phoneError)}
                onChange={(event) => {
                  setServerPhoneError(null)
                  setPhone(event.target.value)
                }}
              />
              {phoneError ? (
                <p role="alert" className="text-sm text-destructive">
                  {phoneError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="vendor-notes">Notes</Label>
            <Textarea
              id="vendor-notes"
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
            {pending ? "Saving…" : vendorId ? "Save changes" : "Save vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
