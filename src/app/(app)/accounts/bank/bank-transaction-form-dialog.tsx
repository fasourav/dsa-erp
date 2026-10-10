"use client"

import { useState, useTransition } from "react"

import {
  addBankMovement,
  addBankTransfer,
  updateBankMovement,
  type BankMovementFieldErrors,
  type BankTransferFieldErrors,
} from "@/app/(app)/accounts/bank/actions"
import { RecordPaymentFields } from "@/components/record-payment-fields"
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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { BankAccountChoice } from "@/lib/bank-account"
import { defaultBankAccountId } from "@/lib/bank-account"
import type { BankAccountRow, BankTransactionRow } from "@/lib/bank"
import { parsePositiveAmount } from "@/lib/payment-status"
import { isIsoDate, todayIsoDate } from "@/lib/project-validation"

function accountChoices(accounts: readonly BankAccountRow[]): BankAccountChoice[] {
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    isActive: account.isActive,
  }))
}

export function BankMovementDialog({
  open,
  onOpenChange,
  kind,
  transaction,
  accounts,
  paymentMethods,
  defaultAccountId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: "deposit" | "withdrawal"
  transaction: BankTransactionRow | null
  accounts: readonly BankAccountRow[]
  paymentMethods: readonly string[]
  defaultAccountId: string | null
}) {
  const choices = accountChoices(accounts)
  const transactionId = transaction?.id ?? null
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "")
  const [date, setDate] = useState(transaction?.transactionDate || todayIsoDate())
  const [bankAccountId, setBankAccountId] = useState(
    defaultBankAccountId(choices, transaction?.bankAccountId || defaultAccountId || ""),
  )
  const [paymentMethod, setPaymentMethod] = useState(transaction?.paymentMethod ?? "")
  const [notes, setNotes] = useState(transaction?.notes ?? "")
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<BankMovementFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()
  const parsedAmount = parsePositiveAmount(amount)
  const title = kind === "deposit" ? "Deposit" : "Withdrawal"

  function handleSubmit() {
    setAttempted(true)
    setServerErrors({})
    setFormError(null)
    if (!isIsoDate(date) || parsedAmount === null || !bankAccountId) {
      if (!bankAccountId) {
        setServerErrors({ bankAccountId: "Choose a bank account." })
      }
      return
    }

    const input = {
      kind,
      bankAccountId,
      transactionDate: date,
      amount: amount.trim(),
      paymentMethod,
      notes,
    }

    startSubmit(async () => {
      try {
        const result = transactionId
          ? await updateBankMovement(transactionId, input)
          : await addBankMovement(input)
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
        setFormError(`Could not save this ${title.toLowerCase()}.`)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="overflow-hidden sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{transactionId ? `Edit ${title}` : title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <RecordPaymentFields
            idPrefix={`bank-${kind}`}
            amount={amount}
            onAmountChange={setAmount}
            date={date}
            onDateChange={setDate}
            bankAccountId={bankAccountId}
            onBankAccountIdChange={setBankAccountId}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            notes={notes}
            onNotesChange={setNotes}
            accounts={choices}
            paymentMethods={paymentMethods}
            disabled={pending}
            amountError={
              serverErrors.amount ??
              (attempted && parsedAmount === null
                ? amount.trim()
                  ? "Enter an amount greater than 0."
                  : "Enter an amount."
                : null)
            }
            dateError={
              serverErrors.transactionDate ??
              (attempted && !isIsoDate(date) ? "Enter a date." : null)
            }
            accountError={serverErrors.bankAccountId ?? null}
          />
          {formError ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {formError}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Saving…" : transactionId ? "Save Changes" : `Save ${title}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function BankTransferDialog({
  open,
  onOpenChange,
  accounts,
  paymentMethods,
  defaultAccountId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: readonly BankAccountRow[]
  paymentMethods: readonly string[]
  defaultAccountId: string | null
}) {
  const choices = accountChoices(accounts)
  const [amount, setAmount] = useState("")
  const [date, setDate] = useState(todayIsoDate())
  const [fromAccountId, setFromAccountId] = useState(
    defaultBankAccountId(choices, defaultAccountId ?? ""),
  )
  const [toAccountId, setToAccountId] = useState(
    choices.find((account) => account.id !== fromAccountId)?.id ?? "",
  )
  const [paymentMethod, setPaymentMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<BankTransferFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()
  const parsedAmount = parsePositiveAmount(amount)
  const items = choices.map((account) => ({
    value: account.id,
    label: account.name || "Account",
  }))

  function handleSubmit() {
    setAttempted(true)
    setServerErrors({})
    setFormError(null)
    if (
      !isIsoDate(date) ||
      parsedAmount === null ||
      !fromAccountId ||
      !toAccountId ||
      fromAccountId === toAccountId
    ) {
      return
    }

    startSubmit(async () => {
      try {
        const result = await addBankTransfer({
          fromAccountId,
          toAccountId,
          transactionDate: date,
          amount: amount.trim(),
          paymentMethod,
          notes,
        })
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
        setFormError("Could not save this transfer.")
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && pending) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="overflow-hidden sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Transfer</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <RecordPaymentFields
            idPrefix="bank-transfer"
            amount={amount}
            onAmountChange={setAmount}
            date={date}
            onDateChange={setDate}
            bankAccountId={fromAccountId}
            onBankAccountIdChange={setFromAccountId}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            notes={notes}
            onNotesChange={setNotes}
            accounts={choices}
            paymentMethods={paymentMethods}
            disabled={pending}
            amountError={
              serverErrors.amount ??
              (attempted && parsedAmount === null
                ? amount.trim()
                  ? "Enter an amount greater than 0."
                  : "Enter an amount."
                : null)
            }
            dateError={
              serverErrors.transactionDate ??
              (attempted && !isIsoDate(date) ? "Enter a date." : null)
            }
            accountError={serverErrors.fromAccountId ?? null}
            accountLabel="From Account"
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-transfer-to">To Account</Label>
            <Select
              items={items}
              value={toAccountId}
              disabled={pending}
              onValueChange={(value) => setToAccountId(value ?? "")}
            >
              <SelectTrigger id="bank-transfer-to" className="w-full">
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
            {serverErrors.toAccountId ||
            (attempted && fromAccountId && fromAccountId === toAccountId) ? (
              <p role="alert" className="text-sm text-destructive">
                {serverErrors.toAccountId ?? "Choose a different account."}
              </p>
            ) : null}
          </div>
          {choices.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Add another bank account before transferring.
            </p>
          ) : null}
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
          <Button
            type="button"
            disabled={pending || choices.length < 2}
            onClick={handleSubmit}
          >
            {pending ? "Saving…" : "Save Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
