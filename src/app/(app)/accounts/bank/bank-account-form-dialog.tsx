"use client"

import { useState, useTransition, type ReactNode } from "react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    serverErrors.name ?? (attempted && !name.trim() ? "Enter an account name." : null)
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
          return
        }
        if (result.error) {
          setFormError(result.error)
          return
        }
        onOpenChange(false)
      } catch {
        setFormError("Could not save this bank account.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{accountId ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Field id="bank-account-name" label="Account Name" error={nameError}>
            <Input
              id="bank-account-name"
              value={name}
              disabled={pending}
              aria-invalid={Boolean(nameError)}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field id="bank-account-holder" label="Account Holder Name" error={holderError}>
            <Input
              id="bank-account-holder"
              value={accountHolderName}
              disabled={pending}
              aria-invalid={Boolean(holderError)}
              onChange={(event) => setAccountHolderName(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="bank-account-number" label="Account Number" error={numberError}>
              <Input
                id="bank-account-number"
                value={accountNumber}
                disabled={pending}
                aria-invalid={Boolean(numberError)}
                onChange={(event) => setAccountNumber(event.target.value)}
              />
            </Field>
            <Field id="bank-account-bank" label="Bank Name" error={bankError}>
              <Input
                id="bank-account-bank"
                value={bankName}
                disabled={pending}
                aria-invalid={Boolean(bankError)}
                onChange={(event) => setBankName(event.target.value)}
              />
            </Field>
          </div>
          <Field id="bank-account-routing" label="Routing Number" error={routingError}>
            <Input
              id="bank-account-routing"
              value={routingNumber}
              disabled={pending}
              aria-invalid={Boolean(routingError)}
              onChange={(event) => setRoutingNumber(event.target.value)}
            />
          </Field>
          <Field id="bank-account-address" label="Address" error={addressError}>
            <Textarea
              id="bank-account-address"
              value={address}
              disabled={pending}
              aria-invalid={Boolean(addressError)}
              onChange={(event) => setAddress(event.target.value)}
            />
          </Field>
          <Field id="bank-account-opening" label="Opening Balance" error={openingError}>
            <Input
              id="bank-account-opening"
              inputMode="decimal"
              value={openingBalance}
              disabled={pending || Boolean(accountId)}
              aria-invalid={Boolean(openingError)}
              onChange={(event) => setOpeningBalance(event.target.value)}
            />
            {accountId ? (
              <p className="text-sm text-muted-foreground">
                Opening balance is set when the account is created.
              </p>
            ) : null}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="bank-account-currency" label="Currency" error={currencyError}>
              <Input
                id="bank-account-currency"
                value={currency}
                disabled={pending}
                aria-invalid={Boolean(currencyError)}
                onChange={(event) => setCurrency(event.target.value)}
              />
            </Field>
            <Field id="bank-account-sort-order" label="Sort Order" error={sortOrderError}>
              <Input
                id="bank-account-sort-order"
                inputMode="numeric"
                value={sortOrder}
                disabled={pending}
                aria-invalid={Boolean(sortOrderError)}
                onChange={(event) => setSortOrder(event.target.value)}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-account-status">Status</Label>
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
          </div>
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
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

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error: string | null
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
