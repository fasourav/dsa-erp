"use client"

import { savedToast } from "@/lib/saved"
import { useEffect, useState, useTransition } from "react"

import {
  addVendor,
  loadVendorCategoryOptions,
  updateVendor,
  type VendorFormFieldErrors,
} from "@/app/(app)/vendors/actions"
import { RecordAttachments } from "@/components/record-attachments"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Textarea } from "@/components/ui/textarea"
import { escapeLikePattern, isValidEmail } from "@/lib/client-validation"
import {
  CALLING_CODES,
  callingCodeByValue,
  callingCodeMatches,
  parseStoredPhone,
  phoneFieldError,
  phoneMatchKey,
  toE164,
  type CallingCode,
} from "@/lib/phone"
import { createClient } from "@/lib/supabase/client"
import type { VendorKind, VendorSummary } from "@/lib/vendor-summary"

const DUPLICATE_CHECK_DELAY_MS = 350

const NAME_DUPLICATE_MESSAGE =
  "A vendor with this name already exists."

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
  const [callingCode, setCallingCode] = useState(
    () => parseStoredPhone(vendor?.phone ?? "").callingCode,
  )
  const [nationalPhone, setNationalPhone] = useState(
    () => parseStoredPhone(vendor?.phone ?? "").national,
  )
  const [address, setAddress] = useState(vendor?.address ?? "")
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
  const trimmedPhone = nationalPhone.trim()
  const composedPhone = toE164(callingCode, trimmedPhone)

  const nameKey =
    kind && trimmedActiveName
      ? `${kind}|${trimmedActiveName.toLowerCase()}|${phoneMatchKey(composedPhone)}`
      : ""
  const emailFormatError =
    trimmedEmail && !isValidEmail(trimmedEmail)
      ? "Enter a valid email address."
      : null
  const phoneDigitError = phoneFieldError(callingCode, trimmedPhone)

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

        const normalizedPhone = phoneMatchKey(composedPhone)
        const duplicate = (data ?? []).some((row) => {
          const rowPhone = row.phone?.trim() ?? ""
          if (!normalizedPhone) {
            return rowPhone === ""
          }
          return rowPhone !== "" && phoneMatchKey(rowPhone) === normalizedPhone
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
  }, [open, nameKey, kind, trimmedActiveName, composedPhone, vendorId, supabase])

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
      phone: composedPhone,
      address: address.trim(),
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

        savedToast()
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
      <DialogContent
        className="overflow-hidden sm:max-w-lg"
        mobileLayout="nav"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>
            {vendorId ? "Edit Vendor" : "Add New Vendor"}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {vendorId ? <RecordAttachments parentType="vendor" parentId={vendorId} /> : null}
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(kindRequiredError) || undefined}>
              <FieldTitle id="vendor-kind-label">Vendor Type</FieldTitle>
              <div
                role="group"
                aria-labelledby="vendor-kind-label"
                className="flex min-h-11 items-center gap-6 md:min-h-10.5"
              >
                <label className="flex min-h-11 items-center gap-2.5 text-base md:min-h-0 md:text-sm">
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
                <label className="flex min-h-11 items-center gap-2.5 text-base md:min-h-0 md:text-sm">
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
              {kindRequiredError ? <FieldError>{kindRequiredError}</FieldError> : null}
            </Field>

            {kind ? (
              <Field data-invalid={Boolean(nameError) || undefined}>
                <FieldLabel htmlFor={nameField.id}>{nameField.label}</FieldLabel>
                <Input
                  id={nameField.id}
                  value={nameField.value}
                  autoComplete={kind === "company" ? "organization" : "name"}
                  autoCapitalize="words"
                  enterKeyHint="next"
                  disabled={pending}
                  aria-invalid={Boolean(nameError)}
                  onChange={(event) => nameField.onChange(event.target.value)}
                />
                {nameError ? <FieldError>{nameError}</FieldError> : null}
              </Field>
            ) : null}

            <Field>
              <FieldLabel htmlFor="vendor-category">Vendor Category</FieldLabel>
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
            </Field>

            <Field span="half" data-invalid={Boolean(emailError) || undefined}>
              <FieldLabel htmlFor="vendor-email">Email</FieldLabel>
              <Input
                id="vendor-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                value={email}
                disabled={pending}
                aria-invalid={Boolean(emailError)}
                onChange={(event) => {
                  setServerEmailError(null)
                  setEmail(event.target.value)
                }}
              />
              {emailError ? <FieldError>{emailError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(phoneError) || undefined}>
              <FieldLabel htmlFor="vendor-phone">Phone</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <CallingCodePicker
                    value={callingCode}
                    disabled={pending}
                    onChange={(next) => {
                      setServerPhoneError(null)
                      setCallingCode(next)
                    }}
                  />
                </InputGroupAddon>
                <InputGroupInput
                  id="vendor-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  enterKeyHint="next"
                  value={nationalPhone}
                  disabled={pending}
                  aria-invalid={Boolean(phoneError)}
                  placeholder="1712-345678"
                  onChange={(event) => {
                    setServerPhoneError(null)
                    setNationalPhone(event.target.value)
                  }}
                />
              </InputGroup>
              {phoneError ? <FieldError>{phoneError}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="vendor-address">Address</FieldLabel>
              <Textarea
                id="vendor-address"
                value={address}
                autoComplete="street-address"
                disabled={pending}
                onChange={(event) => setAddress(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="vendor-notes">Notes</FieldLabel>
              <Textarea
                id="vendor-notes"
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
            {pending ? "Saving…" : vendorId ? "Save Changes" : "Save Vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CallingCodePicker({
  value,
  disabled,
  onChange,
}: {
  value: string
  disabled: boolean
  onChange: (code: string) => void
}) {
  const selected = callingCodeByValue(value)

  return (
    <Combobox
      items={CALLING_CODES}
      value={selected}
      disabled={disabled}
      filter={callingCodeMatches}
      isItemEqualToValue={(item, current) => item.value === current.value}
      onValueChange={(next) => {
        if (next) onChange(next.value)
      }}
    >
      <ComboboxTrigger
        disabled={disabled}
        aria-label="Country code"
        render={<Button type="button" variant="ghost" className="gap-1 font-semibold" />}
      >
        {selected.label}
      </ComboboxTrigger>
      <ComboboxContent className="min-w-64">
        <ComboboxInput
          aria-label="Search country codes"
          placeholder="Search"
          showTrigger={false}
          disabled={disabled}
        />
        <ComboboxEmpty>No matches</ComboboxEmpty>
        <ComboboxList>
          {(item: CallingCode) => (
            <ComboboxItem key={item.value} value={item}>
              {item.country} {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
