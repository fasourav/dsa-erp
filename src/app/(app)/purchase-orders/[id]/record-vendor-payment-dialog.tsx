"use client"

import { useState, useTransition } from "react"

import {
  recordPurchaseOrderPayment,
  type RecordVendorPaymentFieldErrors,
} from "@/app/(app)/purchase-orders/[id]/actions"
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

    if (!isIsoDate(paidOn) || parsedAmount === null || !bankAccountId) {
      if (!bankAccountId) {
        setServerErrors({ bankAccountId: "Choose a bank account." })
      }
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
          newAccountName: "",
          newBankName: "",
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
          <RecordPaymentFields
            idPrefix="record-payment"
            amount={amount}
            onAmountChange={setAmount}
            date={paidOn}
            onDateChange={setPaidOn}
            bankAccountId={bankAccountId}
            onBankAccountIdChange={setBankAccountId}
            paymentMethod={method}
            onPaymentMethodChange={setMethod}
            notes={notes}
            onNotesChange={setNotes}
            accounts={bankAccounts}
            paymentMethods={paymentMethods}
            disabled={pending}
            amountError={amountError}
            dateError={dateError}
            accountError={accountError}
          />
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
