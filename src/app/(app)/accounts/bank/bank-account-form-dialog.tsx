"use client"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BankAccountRow } from "@/lib/bank"
import { parseSortOrder } from "@/lib/lookup-catalogs"

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
  const [bankName, setBankName] = useState(account?.bankName ?? "")
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
  const currencyError =
    serverErrors.currency ??
    (attempted && !currency.trim() ? "Enter a currency." : null)
  const sortOrderError =
    serverErrors.sortOrder ??
    (attempted && parseSortOrder(sortOrder) === null
      ? "Enter a whole number."
      : null)
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
    if (!name.trim() || !currency.trim() || parsedSortOrder === null) {
      return
    }

    const input = {
      name: name.trim(),
      bankName: bankName.trim(),
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
      <DialogContent
        className="overflow-hidden sm:max-w-lg"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>
            {accountId ? "Edit Bank Account" : "Add Bank Account"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-account-name">Account Name</Label>
            <Input
              id="bank-account-name"
              value={name}
              disabled={pending}
              aria-invalid={Boolean(nameError)}
              onChange={(event) => setName(event.target.value)}
            />
            {nameError ? (
              <p role="alert" className="text-sm text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bank-account-bank">Bank</Label>
              <Input
                id="bank-account-bank"
                value={bankName}
                disabled={pending}
                onChange={(event) => setBankName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bank-account-currency">Currency</Label>
              <Input
                id="bank-account-currency"
                value={currency}
                disabled={pending}
                aria-invalid={Boolean(currencyError)}
                onChange={(event) => setCurrency(event.target.value)}
              />
              {currencyError ? (
                <p role="alert" className="text-sm text-destructive">
                  {currencyError}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-account-sort-order">Sort Order</Label>
            <Input
              id="bank-account-sort-order"
              inputMode="numeric"
              value={sortOrder}
              disabled={pending}
              aria-invalid={Boolean(sortOrderError)}
              onChange={(event) => setSortOrder(event.target.value)}
            />
            {sortOrderError ? (
              <p role="alert" className="text-sm text-destructive">
                {sortOrderError}
              </p>
            ) : null}
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
          <DialogClose
            render={
              <Button type="button" variant="outline" disabled={pending} />
            }
          >
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
