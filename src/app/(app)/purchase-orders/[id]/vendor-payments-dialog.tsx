"use client"

import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"

import {
  addVendorPayment,
  deleteVendorPayment,
  updateVendorPayment,
  type VendorPaymentFieldErrors,
} from "@/app/(app)/purchase-orders/[id]/actions"
import { RecordPaymentFields } from "@/components/record-payment-fields"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
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
import { formatIsoDate, formatMoney } from "@/lib/format"
import { parsePositiveAmount } from "@/lib/payment-status"
import { isIsoDate, todayIsoDate } from "@/lib/project-validation"
import type {
  VendorInvoiceRow,
  VendorPaymentRow,
} from "@/lib/vendor-invoice-summary"

export function VendorPaymentsDialog({
  open,
  onOpenChange,
  invoice,
  paymentMethods,
  expenseCategories,
  bankAccounts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: VendorInvoiceRow | null
  paymentMethods: readonly string[]
  expenseCategories: readonly string[]
  bankAccounts: readonly BankAccountChoice[]
}) {
  void expenseCategories
  const [payment, setPayment] = useState<VendorPaymentRow | null>(null)
  const [editing, setEditing] = useState(false)
  const [formSession, setFormSession] = useState(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<VendorPaymentRow | null>(
    null,
  )
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && deleting) {
      return
    }

    if (!nextOpen) {
      setEditing(false)
      setPayment(null)
    }

    onOpenChange(nextOpen)
  }

  function openForm(next: VendorPaymentRow | null) {
    setPayment(next)
    setFormSession((current) => current + 1)
    setEditing(true)
  }

  function confirmDelete() {
    if (!pendingDelete) {
      return
    }

    const id = pendingDelete.id
    startDelete(async () => {
      try {
        const result = await deleteVendorPayment(id)
        if (result.error) {
          setDeleteError(result.error)
          return
        }

        setDeleteOpen(false)
        setDeleteError(null)
      } catch {
        setDeleteError("Could not delete this payment.")
      }
    })
  }

  const title = editing
    ? payment
      ? "Edit Vendor Payment"
      : "Record Payment"
    : "Vendor Payments"

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-hidden sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          {editing && invoice ? (
            <PaymentForm
              key={formSession}
              invoice={invoice}
              payment={payment}
              paymentMethods={paymentMethods}
              bankAccounts={bankAccounts}
              onCancel={() => setEditing(false)}
              onSaved={() => setEditing(false)}
            />
          ) : (
            <>
              <DialogBody className="flex flex-col gap-4">
                {invoice ? (
                  <p className="text-sm text-muted-foreground">
                    Amount {formatMoney(invoice.amount)} · Paid{" "}
                    {formatMoney(invoice.paid)} · Balance{" "}
                    {formatMoney(invoice.balance)}
                  </p>
                ) : null}
                {invoice && invoice.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No Payments Recorded Yet.
                  </p>
                ) : null}
                {invoice?.payments.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium tabular-nums">
                        {formatMoney(row.amount)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {row.paidOn ? formatIsoDate(row.paidOn) : "—"}
                        {row.method ? ` · ${row.method}` : ""}
                        {row.bankAccountName ? ` · ${row.bankAccountName}` : ""}
                        {row.expenseCategory ? ` · ${row.expenseCategory}` : ""}
                        {row.reference ? ` · ${row.reference}` : ""}
                      </p>
                      {row.notes ? (
                        <p className="text-sm text-muted-foreground">{row.notes}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openForm(row)}
                      >
                        <Pencil aria-hidden="true" data-icon="inline-start" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setDeleteError(null)
                          setPendingDelete(row)
                          setDeleteOpen(true)
                        }}
                      >
                        <Trash2 aria-hidden="true" data-icon="inline-start" />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </DialogBody>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Close
                </DialogClose>
                <Button
                  type="button"
                  disabled={!invoice || invoice.status === "void"}
                  onClick={() => openForm(null)}
                >
                  <Plus aria-hidden="true" data-icon="inline-start" />
                  Record Payment
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(nextOpen) => {
          if (nextOpen || deleting) {
            return
          }

          setDeleteOpen(false)
          setDeleteError(null)
        }}
        title="Delete Vendor Payment"
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={confirmDelete}
      />
    </>
  )
}

function PaymentForm({
  invoice,
  payment,
  paymentMethods,
  bankAccounts,
  onCancel,
  onSaved,
}: {
  invoice: VendorInvoiceRow
  payment: VendorPaymentRow | null
  paymentMethods: readonly string[]
  bankAccounts: readonly BankAccountChoice[]
  onCancel: () => void
  onSaved: () => void
}) {
  const [paidOn, setPaidOn] = useState(payment?.paidOn || todayIsoDate())
  const [amount, setAmount] = useState(payment ? String(payment.amount) : "")
  const [method, setMethod] = useState(payment?.method ?? "")
  const reference = payment?.reference ?? ""
  const expenseCategory = payment?.expenseCategory ?? ""
  const [notes, setNotes] = useState(payment?.notes ?? "")
  const [bankAccountId, setBankAccountId] = useState(
    defaultBankAccountId(bankAccounts, payment?.bankAccountId ?? ""),
  )
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<VendorPaymentFieldErrors>({})
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

    const input = {
      paidOn,
      amount: amount.trim(),
      method: method.trim(),
      reference: reference.trim(),
      notes: notes.trim(),
      expenseCategory: expenseCategory.trim(),
      bankAccountId,
      newAccountName: "",
      newBankName: "",
    }

    startSubmit(async () => {
      try {
        const result = payment
          ? await updateVendorPayment(payment.id, input)
          : await addVendorPayment(invoice.id, input)

        if (result.fieldErrors) {
          setServerErrors(result.fieldErrors)
          return
        }

        if (result.error) {
          setFormError(result.error)
          return
        }

        onSaved()
      } catch {
        setFormError("Could not save this payment.")
      }
    })
  }

  return (
    <>
      <DialogBody className="flex flex-col gap-4">
        <RecordPaymentFields
          idPrefix="vendor-payment"
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
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button type="button" disabled={pending} onClick={handleSubmit}>
          {pending ? "Saving…" : payment ? "Save Changes" : "Save Payment"}
        </Button>
      </DialogFooter>
    </>
  )
}
