"use client"

import { savedToast } from "@/lib/saved"
import { useState, useTransition } from "react"

import {
  addBankAccount,
  updateBankAccount,
  type BankAccountFieldErrors,
} from "@/app/(app)/accounts/bank/actions"
import { Button } from "@/components/ui/button"
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
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { BankAccountRow } from "@/lib/bank"
import { parseSortOrder } from "@/lib/lookup-catalogs"
import { parseProjectValue } from "@/lib/project-validation"

export function BankAccountFormDialog({
  open,
  onOpenChange,
  account,
  suggestedSortOrder,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: BankAccountRow | null
  suggestedSortOrder: number
}) {
  const accountId = account?.id ?? null
  const [name, setName] = useState(account?.name ?? "")
  const [accountHolderName, setAccountHolderName] = useState(account?.accountHolderName ?? "")
  const [accountNumber, setAccountNumber] = useState(account?.accountNumber ?? "")
  const [bankName, setBankName] = useState(account?.bankName ?? "")
  const [routingNumber, setRoutingNumber] = useState(account?.routingNumber ?? "")
  const [address, setAddress] = useState(account?.address ?? "")
  const [openingBalance, setOpeningBalance] = useState(
    account ? String(account.openingBalance) : "",
  )
  const [currency, setCurrency] = useState(account?.currency || "BDT")
  const [sortOrder, setSortOrder] = useState(
    String(account?.sortOrder ?? suggestedSortOrder),
  )
  const [isActive, setIsActive] = useState(account ? account.isActive : true)
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<BankAccountFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const nameError =
    serverErrors.name ??
    (attempted && !name.trim() ? "Enter an account nickname." : null)
  const holderError =
    serverErrors.accountHolderName ??
    (attempted && !accountHolderName.trim() ? "Enter the account holder name." : null)
  const numberError =
    serverErrors.accountNumber ??
    (attempted && !accountNumber.trim() ? "Enter the account number." : null)
  const bankError =
    serverErrors.bankName ??
    (attempted && !bankName.trim() ? "Enter the bank name." : null)
  const routingError =
    serverErrors.routingNumber ??
    (attempted && !routingNumber.trim() ? "Enter the routing number." : null)
  const addressError =
    serverErrors.address ?? (attempted && !address.trim() ? "Enter the address." : null)
  const openingError =
    serverErrors.openingBalance ??
    (!accountId && attempted && parseProjectValue(openingBalance) === null
      ? openingBalance.trim()
        ? "Enter an opening balance of 0 or more."
        : "Enter the opening balance."
      : null)
  const currencyError =
    serverErrors.currency ??
    (attempted && !currency.trim() ? "Enter a currency." : null)
  const sortOrderError =
    serverErrors.sortOrder ??
    (attempted && parseSortOrder(sortOrder) === null ? "Enter a whole number." : null)
  const statusItems = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
  ]

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) {
      return
    }
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setAttempted(true)
    setServerErrors({})
    setFormError(null)

    const parsedSortOrder = parseSortOrder(sortOrder)
    const parsedOpening = parseProjectValue(openingBalance)
    if (
      !name.trim() ||
      !accountHolderName.trim() ||
      !accountNumber.trim() ||
      !bankName.trim() ||
      !routingNumber.trim() ||
      !address.trim() ||
      !currency.trim() ||
      parsedSortOrder === null ||
      (!accountId && parsedOpening === null)
    ) {
      return
    }

    const input = {
      name: name.trim(),
      accountHolderName: accountHolderName.trim(),
      accountNumber: accountNumber.trim(),
      bankName: bankName.trim(),
      routingNumber: routingNumber.trim(),
      address: address.trim(),
      openingBalance: accountId ? String(account?.openingBalance ?? 0) : openingBalance.trim(),
      currency: currency.trim(),
      isActive,
      sortOrder: parsedSortOrder,
    }

    startSubmit(async () => {
      try {
        const result = accountId
          ? await updateBankAccount(accountId, input)
          : await addBankAccount(input)
        if (result.fieldErrors) {
          setServerErrors(result.fieldErrors)
        }
        if (result.error) {
          setFormError(result.error)
        }
        if (result.fieldErrors || result.error) return
        savedToast()
        onOpenChange(false)
      } catch {
        setFormError("Could not save this bank account.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="overflow-hidden sm:max-w-lg"
        mobileLayout="nav"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{accountId ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FieldGroup layout="inset">
            <Field span="half" data-invalid={Boolean(nameError) || undefined}>
              <FieldLabel htmlFor="bank-account-name">Account Nickname</FieldLabel>
              <Input
                id="bank-account-name"
                value={name}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(nameError)}
                onChange={(event) => setName(event.target.value)}
              />
              <FieldDescription>
                How this account appears in the app, e.g. Operating Account
              </FieldDescription>
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(holderError) || undefined}>
              <FieldLabel htmlFor="bank-account-holder">Account Holder Name</FieldLabel>
              <Input
                id="bank-account-holder"
                value={accountHolderName}
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(holderError)}
                onChange={(event) => setAccountHolderName(event.target.value)}
              />
              <FieldDescription>Name registered with the bank</FieldDescription>
              {holderError ? <FieldError>{holderError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(numberError) || undefined}>
              <FieldLabel htmlFor="bank-account-number">Account Number</FieldLabel>
              <Input
                id="bank-account-number"
                value={accountNumber}
                autoComplete="off"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(numberError)}
                onChange={(event) => setAccountNumber(event.target.value)}
              />
              {numberError ? <FieldError>{numberError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(bankError) || undefined}>
              <FieldLabel htmlFor="bank-account-bank">Bank Name</FieldLabel>
              <Input
                id="bank-account-bank"
                value={bankName}
                autoComplete="organization"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(bankError)}
                onChange={(event) => setBankName(event.target.value)}
              />
              <FieldDescription>e.g. BRAC Bank</FieldDescription>
              {bankError ? <FieldError>{bankError}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(routingError) || undefined}>
              <FieldLabel htmlFor="bank-account-routing">Routing Number</FieldLabel>
              <Input
                id="bank-account-routing"
                value={routingNumber}
                autoComplete="off"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(routingError)}
                onChange={(event) => setRoutingNumber(event.target.value)}
              />
              {routingError ? <FieldError>{routingError}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(addressError) || undefined}>
              <FieldLabel htmlFor="bank-account-address">Address</FieldLabel>
              <Textarea
                id="bank-account-address"
                value={address}
                autoComplete="street-address"
                disabled={pending}
                aria-invalid={Boolean(addressError)}
                onChange={(event) => setAddress(event.target.value)}
              />
              {addressError ? <FieldError>{addressError}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(openingError) || undefined}>
              <FieldLabel htmlFor="bank-account-opening">Opening Balance</FieldLabel>
              <Input
                id="bank-account-opening"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="next"
                value={openingBalance}
                disabled={pending || Boolean(accountId)}
                aria-invalid={Boolean(openingError)}
                onChange={(event) => setOpeningBalance(event.target.value)}
              />
              {accountId ? (
                <FieldDescription>
                  Opening balance is set when the account is created.
                </FieldDescription>
              ) : null}
              {openingError ? <FieldError>{openingError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(currencyError) || undefined}>
              <FieldLabel htmlFor="bank-account-currency">Currency</FieldLabel>
              <Input
                id="bank-account-currency"
                value={currency}
                autoComplete="off"
                autoCapitalize="characters"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(currencyError)}
                onChange={(event) => setCurrency(event.target.value)}
              />
              {currencyError ? <FieldError>{currencyError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(sortOrderError) || undefined}>
              <FieldLabel htmlFor="bank-account-sort-order">Sort Order</FieldLabel>
              <Input
                id="bank-account-sort-order"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                value={sortOrder}
                disabled={pending}
                aria-invalid={Boolean(sortOrderError)}
                onChange={(event) => setSortOrder(event.target.value)}
              />
              {sortOrderError ? <FieldError>{sortOrderError}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="bank-account-status">Status</FieldLabel>
              <Select
                items={statusItems}
                value={isActive ? "active" : "inactive"}
                disabled={pending}
                onValueChange={(value) => setIsActive(value !== "inactive")}
              >
                <SelectTrigger id="bank-account-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {statusItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          {formError ? (
            <p role="alert" className="px-1 text-sm text-destructive md:px-0">
              {formError}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Saving…" : accountId ? "Save Changes" : "Save Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
