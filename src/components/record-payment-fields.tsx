"use client"

import Link from "next/link"

import { NameCombobox } from "@/components/name-combobox"
import { Button } from "@/components/ui/button"
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
import type { BankAccountChoice } from "@/lib/bank-account"

export function RecordPaymentFields({
  idPrefix,
  amount,
  onAmountChange,
  date,
  onDateChange,
  bankAccountId,
  onBankAccountIdChange,
  paymentMethod,
  onPaymentMethodChange,
  notes,
  onNotesChange,
  accounts,
  paymentMethods,
  disabled,
  amountError,
  dateError,
  accountError,
  dateLabel = "Date",
  accountLabel = "Bank Account",
  showAmount = true,
}: {
  idPrefix: string
  amount: string
  onAmountChange: (value: string) => void
  date: string
  onDateChange: (value: string) => void
  bankAccountId: string
  onBankAccountIdChange: (value: string) => void
  paymentMethod: string
  onPaymentMethodChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  accounts: readonly BankAccountChoice[]
  paymentMethods: readonly string[]
  disabled: boolean
  amountError: string | null
  dateError: string | null
  accountError: string | null
  dateLabel?: string
  accountLabel?: string
  showAmount?: boolean
}) {
  const choices = accounts.filter(
    (account) => account.isActive || account.id === bankAccountId,
  )
  const items = choices.map((account) => ({
    value: account.id,
    label: account.name || "Account",
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className={showAmount ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
        {showAmount ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${idPrefix}-amount`}>Amount</Label>
            <Input
              id={`${idPrefix}-amount`}
              inputMode="decimal"
              value={amount}
              disabled={disabled}
              aria-invalid={Boolean(amountError)}
              onChange={(event) => onAmountChange(event.target.value)}
            />
            {amountError ? (
              <p role="alert" className="text-sm text-destructive">
                {amountError}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-date`}>{dateLabel}</Label>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            value={date}
            disabled={disabled}
            aria-invalid={Boolean(dateError)}
            onChange={(event) => onDateChange(event.target.value)}
          />
          {dateError ? (
            <p role="alert" className="text-sm text-destructive">
              {dateError}
            </p>
          ) : null}
        </div>
      </div>
      {choices.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted p-4">
          <p className="text-sm font-medium">Add Your First Bank Account</p>
          <p className="text-sm text-muted-foreground">
            Payments Need A Bank Account. Add One In Settings Before Saving.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-fit"
            render={<Link href="/settings" />}
          >
            Open Settings
          </Button>
          {accountError ? (
            <p role="alert" className="text-sm text-destructive">
              {accountError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-account`}>{accountLabel}</Label>
          <Select
            items={items}
            value={bankAccountId}
            disabled={disabled}
            onValueChange={(value) => onBankAccountIdChange(value ?? "")}
          >
            <SelectTrigger
              id={`${idPrefix}-account`}
              className="w-full"
              aria-invalid={Boolean(accountError)}
            >
              <SelectValue placeholder="Choose An Account" />
            </SelectTrigger>
            <SelectContent align="start">
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {accountError ? (
            <p role="alert" className="text-sm text-destructive">
              {accountError}
            </p>
          ) : null}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-method`}>Payment Method</Label>
        <NameCombobox
          id={`${idPrefix}-method`}
          value={paymentMethod}
          names={paymentMethods}
          disabled={disabled}
          placeholder="Search Payment Methods"
          onValueChange={onPaymentMethodChange}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
        <Textarea
          id={`${idPrefix}-notes`}
          value={notes}
          disabled={disabled}
          onChange={(event) => onNotesChange(event.target.value)}
        />
      </div>
    </div>
  )
}
