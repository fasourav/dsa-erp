"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BankAccountChoice } from "@/lib/bank-account"

export function BankAccountField({
  idPrefix,
  accounts,
  accountId,
  onAccountIdChange,
  accountName,
  onAccountNameChange,
  bankName,
  onBankNameChange,
  disabled,
  error,
}: {
  idPrefix: string
  accounts: readonly BankAccountChoice[]
  accountId: string
  onAccountIdChange: (value: string) => void
  accountName: string
  onAccountNameChange: (value: string) => void
  bankName: string
  onBankNameChange: (value: string) => void
  disabled: boolean
  error: string | null
}) {
  const choices = accounts.filter(
    (account) => account.isActive || account.id === accountId,
  )

  if (choices.length === 0) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-account-name`}>Bank Account</Label>
          <Input
            id={`${idPrefix}-account-name`}
            value={accountName}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            onChange={(event) => onAccountNameChange(event.target.value)}
          />
          <p className="text-sm text-muted-foreground">
            No Accounts Yet. Saving Adds This One.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-bank-name`}>Bank</Label>
          <Input
            id={`${idPrefix}-bank-name`}
            value={bankName}
            disabled={disabled}
            onChange={(event) => onBankNameChange(event.target.value)}
          />
        </div>
      </div>
    )
  }

  const items = choices.map((account) => ({
    value: account.id,
    label: account.name || "—",
  }))

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${idPrefix}-account`}>Bank Account</Label>
      <Select
        items={items}
        value={accountId || null}
        disabled={disabled}
        onValueChange={(value) => onAccountIdChange(value ?? "")}
      >
        <SelectTrigger
          id={`${idPrefix}-account`}
          className="w-full"
          aria-invalid={Boolean(error)}
        >
          <SelectValue placeholder="Select An Account" />
        </SelectTrigger>
        <SelectContent align="start">
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
