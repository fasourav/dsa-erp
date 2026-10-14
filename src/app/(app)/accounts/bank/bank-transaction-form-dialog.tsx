"use client"

import { savedToast } from "@/lib/saved"
import Link from "next/link"
import { useState, useTransition } from "react"

import {
  addBankMovement,
  addBankTransfer,
  updateBankMovement,
  type BankMovementFieldErrors,
  type BankTransferFieldErrors,
} from "@/app/(app)/accounts/bank/actions"
import { NameCombobox } from "@/components/name-combobox"
import { RecordAttachments } from "@/components/record-attachments"
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
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
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
  const amountError =
    serverErrors.amount ??
    (attempted && parsedAmount === null
      ? amount.trim()
        ? "Enter an amount greater than 0."
        : "Enter an amount."
      : null)
  const dateError =
    serverErrors.transactionDate ??
    (attempted && !isIsoDate(date) ? "Enter a date." : null)

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
        }
        if (result.error) {
          setFormError(result.error)
        }
        if (result.fieldErrors || result.error) return
        savedToast()
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
      <DialogContent
        className="overflow-hidden sm:max-w-lg"
        mobileLayout="nav"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{transactionId ? `Edit ${title}` : title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {transactionId ? (
            <RecordAttachments parentType="bank_transaction" parentId={transactionId} />
          ) : null}
          <PaymentFields
            idPrefix={`bank-${kind}`}
            amount={amount}
            onAmountChange={setAmount}
            date={date}
            onDateChange={setDate}
            bankAccountId={bankAccountId}
            onBankAccountIdChange={setBankAccountId}
            accountLabel="Bank Account"
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            notes={notes}
            onNotesChange={setNotes}
            accounts={choices}
            paymentMethods={paymentMethods}
            disabled={pending}
            amountError={amountError}
            dateError={dateError}
            accountError={serverErrors.bankAccountId ?? null}
          />
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
  const sameAccount = Boolean(fromAccountId) && fromAccountId === toAccountId
  const toError = serverErrors.toAccountId ?? (attempted && sameAccount ? "Choose a different account." : null)
  const amountError =
    serverErrors.amount ??
    (attempted && parsedAmount === null
      ? amount.trim()
        ? "Enter an amount greater than 0."
        : "Enter an amount."
      : null)
  const dateError =
    serverErrors.transactionDate ??
    (attempted && !isIsoDate(date) ? "Enter a date." : null)

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
        }
        if (result.error) {
          setFormError(result.error)
        }
        if (result.fieldErrors || result.error) return
        savedToast()
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
      <DialogContent
        className="overflow-hidden sm:max-w-lg"
        mobileLayout="nav"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>Transfer</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FieldGroup layout="inset">
            <PaymentFieldRows
              idPrefix="bank-transfer"
              amount={amount}
              onAmountChange={setAmount}
              date={date}
              onDateChange={setDate}
              bankAccountId={fromAccountId}
              onBankAccountIdChange={setFromAccountId}
              accountLabel="From Account"
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              notes={notes}
              onNotesChange={setNotes}
              accounts={choices}
              paymentMethods={paymentMethods}
              disabled={pending}
              amountError={amountError}
              dateError={dateError}
              accountError={serverErrors.fromAccountId ?? null}
            />
            <Field data-invalid={Boolean(toError) || undefined}>
              <FieldLabel htmlFor="bank-transfer-to">To Account</FieldLabel>
              <Select
                items={items}
                value={toAccountId}
                disabled={pending}
                onValueChange={(value) => setToAccountId(value ?? "")}
              >
                <SelectTrigger
                  id="bank-transfer-to"
                  className="w-full"
                  aria-invalid={Boolean(toError)}
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
              {toError ? <FieldError>{toError}</FieldError> : null}
            </Field>
            {choices.length < 2 ? (
              <Field>
                <p className="text-sm text-muted-foreground">
                  Add another bank account before transferring.
                </p>
              </Field>
            ) : null}
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

function PaymentFields(
  props: {
    idPrefix: string
    amount: string
    onAmountChange: (value: string) => void
    date: string
    onDateChange: (value: string) => void
    bankAccountId: string
    onBankAccountIdChange: (value: string) => void
    accountLabel: string
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
  },
) {
  return (
    <FieldGroup layout="inset">
      <PaymentFieldRows {...props} />
    </FieldGroup>
  )
}

function PaymentFieldRows({
  idPrefix,
  amount,
  onAmountChange,
  date,
  onDateChange,
  bankAccountId,
  onBankAccountIdChange,
  accountLabel,
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
}: {
  idPrefix: string
  amount: string
  onAmountChange: (value: string) => void
  date: string
  onDateChange: (value: string) => void
  bankAccountId: string
  onBankAccountIdChange: (value: string) => void
  accountLabel: string
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
}) {
  const choices = accounts.filter(
    (account) => account.isActive || account.id === bankAccountId,
  )
  const items = choices.map((account) => ({
    value: account.id,
    label: account.name || "Account",
  }))

  return (
    <>
      <Field span="half" data-invalid={Boolean(amountError) || undefined}>
        <FieldLabel htmlFor={`${idPrefix}-amount`}>Amount</FieldLabel>
        <Input
          id={`${idPrefix}-amount`}
          inputMode="decimal"
          autoComplete="off"
          enterKeyHint="next"
          value={amount}
          disabled={disabled}
          aria-invalid={Boolean(amountError)}
          onChange={(event) => onAmountChange(event.target.value)}
        />
        {amountError ? <FieldError>{amountError}</FieldError> : null}
      </Field>
      <Field span="half" data-invalid={Boolean(dateError) || undefined}>
        <FieldLabel htmlFor={`${idPrefix}-date`}>Date</FieldLabel>
        <Input
          id={`${idPrefix}-date`}
          type="date"
          enterKeyHint="next"
          value={date}
          disabled={disabled}
          aria-invalid={Boolean(dateError)}
          onChange={(event) => onDateChange(event.target.value)}
        />
        {dateError ? <FieldError>{dateError}</FieldError> : null}
      </Field>
      {choices.length === 0 ? (
        <Field data-invalid={Boolean(accountError) || undefined}>
          <p className="text-sm font-medium">Add Your First Bank Account</p>
          <p className="text-sm text-muted-foreground">
            Payments Need A Bank Account. Add One In Settings Before Saving.
          </p>
          <Button
            type="button"
            variant="outline"
            className="w-full md:w-fit"
            render={<Link href="/settings" />}
          >
            Open Settings
          </Button>
          {accountError ? <FieldError>{accountError}</FieldError> : null}
        </Field>
      ) : (
        <Field data-invalid={Boolean(accountError) || undefined}>
          <FieldLabel htmlFor={`${idPrefix}-account`}>{accountLabel}</FieldLabel>
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
          {accountError ? <FieldError>{accountError}</FieldError> : null}
        </Field>
      )}
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-method`}>Payment Method</FieldLabel>
        <NameCombobox
          id={`${idPrefix}-method`}
          value={paymentMethod}
          names={paymentMethods}
          disabled={disabled}
          placeholder="Search Payment Methods"
          onValueChange={onPaymentMethodChange}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-notes`}>Notes</FieldLabel>
        <Textarea
          maxLength={1000}
          id={`${idPrefix}-notes`}
          value={notes}
          disabled={disabled}
          onChange={(event) => onNotesChange(event.target.value)}
        />
      </Field>
    </>
  )
}
