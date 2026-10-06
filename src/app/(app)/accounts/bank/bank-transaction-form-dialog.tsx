"use client"

import { useState, useTransition } from "react"

import {
  addBankTransaction,
  updateBankTransaction,
  type BankTransactionFieldErrors,
} from "@/app/(app)/accounts/bank/actions"
import { NameCombobox } from "@/components/name-combobox"
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
import {
  bankDirectionLabel,
  bankDirections,
  isBankDirection,
  type BankAccountRow,
  type BankTransactionRow,
} from "@/lib/bank"
import type { NamedOption } from "@/lib/operational-expenses"
import { parsePositiveAmount } from "@/lib/payment-status"
import { isIsoDate, todayIsoDate } from "@/lib/project-validation"

const noneValue = "__none__"

export function BankTransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  projects,
  paymentMethods,
  defaultAccountId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: BankTransactionRow | null
  accounts: readonly BankAccountRow[]
  projects: readonly NamedOption[]
  paymentMethods: readonly string[]
  defaultAccountId: string | null
}) {
  const transactionId = transaction?.id ?? null
  const [bankAccountId, setBankAccountId] = useState(
    transaction?.bankAccountId || defaultAccountId || "",
  )
  const [transactionDate, setTransactionDate] = useState(
    transaction?.transactionDate || todayIsoDate(),
  )
  const [direction, setDirection] = useState(transaction?.direction ?? "outflow")
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : "")
  const [paymentMethod, setPaymentMethod] = useState(transaction?.paymentMethod ?? "")
  const [projectId, setProjectId] = useState(transaction?.projectId ?? "")
  const [notes, setNotes] = useState(transaction?.notes ?? "")
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<BankTransactionFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const parsedAmount = parsePositiveAmount(amount)
  const accountItems = accounts.map((account) => ({
    value: account.id,
    label: account.name || "—",
  }))
  const directionItems = bankDirections.map((value) => ({
    value,
    label: bankDirectionLabel(value),
  }))
  const projectItems = [
    { value: noneValue, label: "None" },
    ...projects.map((project) => ({
      value: project.id,
      label: project.name || "—",
    })),
  ]
  const accountError =
    serverErrors.bankAccountId ??
    (attempted && !bankAccountId ? "Choose a bank account." : null)
  const dateError =
    serverErrors.transactionDate ??
    (attempted && !isIsoDate(transactionDate) ? "Enter a date." : null)
  const amountError =
    serverErrors.amount ??
    (attempted && parsedAmount === null
      ? amount.trim()
        ? "Enter an amount greater than 0."
        : "Enter an amount."
      : null)

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

    if (
      !bankAccountId ||
      !isIsoDate(transactionDate) ||
      !isBankDirection(direction) ||
      parsedAmount === null
    ) {
      return
    }

    const input = {
      bankAccountId,
      transactionDate,
      direction,
      amount: amount.trim(),
      sourceKind: "other",
      paymentMethod: paymentMethod.trim(),
      projectId,
      notes: notes.trim(),
    }

    startSubmit(async () => {
      try {
        const result = transactionId
          ? await updateBankTransaction(transactionId, input)
          : await addBankTransaction(input)

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
        setFormError("Could not save this transaction.")
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
            {transactionId ? "Edit bank transaction" : "Add bank transaction"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-tx-account">Bank account</Label>
            <Select
              items={accountItems}
              value={bankAccountId || null}
              disabled={pending}
              onValueChange={(value) => setBankAccountId(value ?? "")}
            >
              <SelectTrigger
                id="bank-tx-account"
                className="w-full"
                aria-invalid={Boolean(accountError)}
              >
                <SelectValue placeholder="Select an account" />
              </SelectTrigger>
              <SelectContent align="start">
                {accountItems.map((item) => (
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bank-tx-date">Date</Label>
              <Input
                id="bank-tx-date"
                type="date"
                value={transactionDate}
                disabled={pending}
                aria-invalid={Boolean(dateError)}
                onChange={(event) => setTransactionDate(event.target.value)}
              />
              {dateError ? (
                <p role="alert" className="text-sm text-destructive">
                  {dateError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bank-tx-amount">Amount</Label>
              <Input
                id="bank-tx-amount"
                inputMode="decimal"
                value={amount}
                disabled={pending}
                aria-invalid={Boolean(amountError)}
                onChange={(event) => setAmount(event.target.value)}
              />
              {amountError ? (
                <p role="alert" className="text-sm text-destructive">
                  {amountError}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-tx-direction">Direction</Label>
            <Select
              items={directionItems}
              value={direction}
              disabled={pending}
              onValueChange={(value) => {
                if (value && isBankDirection(value)) {
                  setDirection(value)
                }
              }}
            >
              <SelectTrigger id="bank-tx-direction" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {directionItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Client payments, vendor payments, and operational expenses are
              recorded on those pages and show up here.
            </p>
            {serverErrors.sourceKind ? (
              <p role="alert" className="text-sm text-destructive">
                {serverErrors.sourceKind}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-tx-method">Payment method</Label>
            <NameCombobox
              id="bank-tx-method"
              value={paymentMethod}
              names={paymentMethods}
              disabled={pending}
              placeholder="Search payment methods"
              onValueChange={setPaymentMethod}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-tx-project">Project</Label>
            <Select
              items={projectItems}
              value={projectId || noneValue}
              disabled={pending}
              onValueChange={(value) =>
                setProjectId(!value || value === noneValue ? "" : value)
              }
            >
              <SelectTrigger id="bank-tx-project" className="w-full">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent align="start">
                {projectItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {serverErrors.projectId ? (
              <p role="alert" className="text-sm text-destructive">
                {serverErrors.projectId}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-tx-notes">Notes</Label>
            <Textarea
              id="bank-tx-notes"
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
            {pending
              ? "Saving…"
              : transactionId
                ? "Save changes"
                : "Save transaction"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
