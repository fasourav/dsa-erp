"use client"

import { useState, useTransition } from "react"

import {
  recordPurchaseOrderPayment,
  type RecordVendorPaymentFieldErrors,
} from "@/app/(app)/purchase-orders/[id]/actions"
import { BankAccountField } from "@/components/bank-account-field"
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
import { Textarea } from "@/components/ui/textarea"
import {
  defaultBankAccountId,
  type BankAccountChoice,
} from "@/lib/bank-account"
import { formatMoney } from "@/lib/format"
import { parsePositiveAmount } from "@/lib/payment-status"
import { isIsoDate, todayIsoDate } from "@/lib/project-validation"
import type { PurchaseOrderDetail } from "@/lib/vendor-invoice-summary"

export function RecordVendorPaymentDialog({
  open,
  onOpenChange,
  purchaseOrder,
  paymentMethods,
  bankAccounts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchaseOrder: PurchaseOrderDetail
  paymentMethods: readonly string[]
  bankAccounts: readonly BankAccountChoice[]
}) {
  const initialAmount =
    purchaseOrder.totalPending > 0 ? String(purchaseOrder.totalPending) : ""
  const [paidOn, setPaidOn] = useState(todayIsoDate())
  const [amount, setAmount] = useState(initialAmount)
  const [method, setMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [bankAccountId, setBankAccountId] = useState(
    defaultBankAccountId(bankAccounts, ""),
  )
  const [accountName, setAccountName] = useState("Operating account")
  const [bankName, setBankName] = useState("")
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<RecordVendorPaymentFieldErrors>(
    {},
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const parsedAmount = parsePositiveAmount(amount)
  const dateError =
    serverErrors.paidOn ??
    (attempted && !isIsoDate(paidOn) ? "Enter a payment date." : null)
  const amountError =
    serverErrors.amount ??
    (attempted && parsedAmount === null
      ? amount.trim()
        ? "Enter a payment greater than 0."
        : "Enter a payment amount."
      : null)
  const accountError = serverErrors.bankAccountId ?? null
  const hasAccounts =
    bankAccounts.some((account) => account.isActive) || Boolean(bankAccountId)

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

    if (!isIsoDate(paidOn) || parsedAmount === null) {
      return
    }

    if (hasAccounts && !bankAccountId) {
      setServerErrors({ bankAccountId: "Choose a bank account." })
      return
    }

    if (!hasAccounts && !accountName.trim()) {
      setServerErrors({ bankAccountId: "Enter an account name." })
      return
    }

    startSubmit(async () => {
      try {
        const result = await recordPurchaseOrderPayment(purchaseOrder.id, {
          paidOn,
          amount: amount.trim(),
          method: method.trim(),
          notes: notes.trim(),
          bankAccountId,
          newAccountName: hasAccounts ? "" : accountName.trim(),
          newBankName: hasAccounts ? "" : bankName.trim(),
          separateInvoice: false,
          invoiceIssuedOn: "",
          invoiceDueOn: "",
          invoiceAmount: "",
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
        setFormError("Could not save this payment.")
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
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Purchase Order Value {formatMoney(purchaseOrder.totalValue)} · Paid{" "}
            {formatMoney(purchaseOrder.totalPaid)} · Pending{" "}
            {formatMoney(purchaseOrder.totalPending)}
          </p>
          <p className="text-sm text-muted-foreground">
            Enter what you paid the vendor. It applies to the amount still due
            on this purchase order.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="record-payment-amount">Amount</Label>
              <Input
                id="record-payment-amount"
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="record-payment-date">Payment Date</Label>
              <Input
                id="record-payment-date"
                type="date"
                value={paidOn}
                disabled={pending}
                aria-invalid={Boolean(dateError)}
                onChange={(event) => setPaidOn(event.target.value)}
              />
              {dateError ? (
                <p role="alert" className="text-sm text-destructive">
                  {dateError}
                </p>
              ) : null}
            </div>
          </div>
          <BankAccountField
            idPrefix="record-payment"
            accounts={bankAccounts}
            accountId={bankAccountId}
            onAccountIdChange={setBankAccountId}
            accountName={accountName}
            onAccountNameChange={setAccountName}
            bankName={bankName}
            onBankNameChange={setBankName}
            disabled={pending}
            error={accountError}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="record-payment-method">Payment Method</Label>
            <NameCombobox
              id="record-payment-method"
              value={method}
              names={paymentMethods}
              disabled={pending}
              placeholder="Search Payment Methods"
              onValueChange={setMethod}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="record-payment-notes">Notes</Label>
            <Textarea
              id="record-payment-notes"
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
            {pending ? "Saving…" : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
