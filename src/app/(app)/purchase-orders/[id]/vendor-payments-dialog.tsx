"use client"

import { savedToast } from "@/lib/saved"
import { useCan } from "@/components/access-provider"

import { Pencil, Plus, Trash2, Wallet } from "lucide-react"
import Link from "next/link"
import { useState, useTransition } from "react"

import { DuplicateWarning } from "@/app/(app)/accounts/duplicate-warning"

import {
  addVendorPayment,
  deleteVendorPayment,
  updateVendorPayment,
  type VendorPaymentFieldErrors,
} from "@/app/(app)/purchase-orders/[id]/actions"
import { RecordAttachments } from "@/components/record-attachments"
import { RecordPaymentFields } from "@/components/record-payment-fields"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
import { Money } from "@/components/money"
import { StatusBadge } from "@/components/status-badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  defaultBankAccountId,
  type BankAccountChoice,
} from "@/lib/bank-account"
import type { DuplicateMatch } from "@/lib/duplicate-outflow"
import { formatIsoDate } from "@/lib/format"
import { formatRecordedAt } from "@/lib/recorded-at"
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
  partyName,
  paymentMethods,
  categoryName,
  bankAccounts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: VendorInvoiceRow | null
  partyName?: string
  paymentMethods: readonly string[]
  categoryName: string
  bankAccounts: readonly BankAccountChoice[]
}) {
  const canAdd = useCan("vendor_payments", "add")
  const canEdit = useCan("vendor_payments", "edit")
  const canDelete = useCan("vendor_payments", "delete")

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
  const subtitle = invoice
    ? [partyName, invoice.description || (invoice.issuedOn ? formatIsoDate(invoice.issuedOn) : "")]
        .filter(Boolean)
        .join(" · ")
    : ""

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className={editing ? "overflow-hidden sm:max-w-lg" : "overflow-hidden"}
          variant={editing ? "default" : "drawer"}
          mobileLayout={editing ? "nav" : "stack"}
          showCloseButton
        >
          <DialogHeader>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogTitle>{title}</DialogTitle>
              {!editing && subtitle ? (
                <DialogDescription>{subtitle}</DialogDescription>
              ) : null}
            </div>
            {!editing && invoice ? (
              <span className="shrink-0 self-center">
                <StatusBadge status={invoice.status} />
              </span>
            ) : null}
          </DialogHeader>
          {editing && invoice ? (
            <PaymentForm
              key={formSession}
              invoice={invoice}
              payment={payment}
              paymentMethods={paymentMethods}
              categoryName={categoryName}
              bankAccounts={bankAccounts}
              onCancel={() => setEditing(false)}
              onSaved={() => setEditing(false)}
            />
          ) : (
            <>
              <DialogBody className="flex flex-col gap-4">
                {invoice ? (
                  <dl className="overflow-hidden rounded-group border border-border">
                    <div className="flex items-center justify-between gap-3 px-4 py-3">
                      <dt className="text-label text-muted-foreground">Amount</dt>
                      <dd>
                        <Money value={invoice.amount} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                      <dt className="text-label text-muted-foreground">Paid</dt>
                      <dd>
                        <Money
                          value={invoice.paid}
                          className={
                            invoice.paid > 0 ? "text-success" : "text-muted-foreground"
                          }
                        />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                      <dt className="text-label text-muted-foreground">Balance</dt>
                      <dd>
                        <Money
                          value={invoice.balance}
                          className={
                            invoice.balance > 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }
                        />
                      </dd>
                    </div>
                  </dl>
                ) : null}
                {invoice && invoice.payments.length === 0 ? (
                  <Empty>
                    <EmptyMedia variant="icon">
                      <Wallet aria-hidden="true" />
                    </EmptyMedia>
                    <EmptyTitle>No Payments Recorded Yet.</EmptyTitle>
                  </Empty>
                ) : null}
                {invoice && invoice.payments.length > 0 ? (
                  <ul className="flex flex-col">
                    {invoice.payments.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-col gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="text-ui font-semibold">
                            <Money value={row.amount} />
                          </p>
                          <p className="text-label text-muted-foreground">
                            {row.paidOn ? formatIsoDate(row.paidOn) : "—"}
                            {row.bankAccountName ? ` · ${row.bankAccountName}` : ""}
                            {row.method ? ` · via ${row.method}` : ""}
                            {row.expenseCategory ? ` · ${row.expenseCategory}` : ""}
                            {row.reference ? ` · ${row.reference}` : ""}
                          </p>
                          {row.notes ? (
                            <p className="text-label text-muted-foreground">{row.notes}</p>
                          ) : null}
                          <p className="text-label text-muted-foreground">
                            {row.createdByName} · {formatRecordedAt(row.createdAt)}
                          </p>
                          <p className="text-label text-muted-foreground">
                            <Link href={`/documents/vouchers/new?payment=${row.id}`} className="underline underline-offset-4">
                              Print / Download
                            </Link>
                            {" · "}
                            <Link
                              href={`/purchase-orders/${row.purchaseOrderId}`}
                              className="underline underline-offset-4"
                            >
                              Purchase Order
                              {row.purchaseOrderIssuedOn
                                ? ` · ${formatIsoDate(row.purchaseOrderIssuedOn)}`
                                : ""}
                            </Link>
                            {" · "}
                            Bill
                            {row.billIssuedOn ? ` · ${formatIsoDate(row.billIssuedOn)}` : ""}
                            {" · "}
                            <Money value={row.billAmount} />
                          </p>
                          <p className="text-label text-muted-foreground">
                            {row.bankLineDate ? (
                              <Link
                                href={`/accounts/bank?account=${row.bankAccountId}`}
                                className="underline underline-offset-4"
                              >
                                Bank Line
                                {row.bankLineAccount ? ` · ${row.bankLineAccount}` : ""}
                                {` · ${formatIsoDate(row.bankLineDate)} · `}
                                <Money value={row.bankLineAmount} />
                              </Link>
                            ) : (
                              "Bank Line · Not Available"
                            )}
                          </p>
                          <RecordAttachments parentType="vendor_payment" parentId={row.id} collapsed />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {canEdit ? (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => openForm(row)}
                            >
                              <Pencil aria-hidden="true" data-icon="inline-start" />
                              Edit
                            </Button>
                          ) : null}
                          {canDelete ? (
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
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </DialogBody>
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="outline" />}>
                  Close
                </DialogClose>
                {canAdd ? (
                <Button
                  type="button"
                  disabled={!invoice || invoice.status === "void" || invoice.balance <= 0}
                  onClick={() => openForm(null)}
                >
                  <Plus aria-hidden="true" data-icon="inline-start" />
                  Record Payment
                </Button>
                ) : null}
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
        itemName={pendingDelete?.reference}
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
  categoryName,
  bankAccounts,
  onCancel,
  onSaved,
}: {
  invoice: VendorInvoiceRow
  payment: VendorPaymentRow | null
  paymentMethods: readonly string[]
  categoryName: string
  bankAccounts: readonly BankAccountChoice[]
  onCancel: () => void
  onSaved: () => void
}) {
  const [paidOn, setPaidOn] = useState(payment?.paidOn || todayIsoDate())
  const [amount, setAmount] = useState(payment ? String(payment.amount) : "")
  const [method, setMethod] = useState(payment?.method ?? "")
  const reference = payment?.reference ?? ""
  const [notes, setNotes] = useState(payment?.notes ?? "")
  const [bankAccountId, setBankAccountId] = useState(
    defaultBankAccountId(bankAccounts, payment?.bankAccountId ?? ""),
  )
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<VendorPaymentFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [confirmNotDuplicate, setConfirmNotDuplicate] = useState(false)
  const [duplicateReason, setDuplicateReason] = useState("")
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
      bankAccountId,
      newAccountName: "",
      newBankName: "",
      confirmNotDuplicate,
      duplicateReason,
    }

    startSubmit(async () => {
      try {
        const result = payment
          ? await updateVendorPayment(payment.id, input)
          : await addVendorPayment(invoice.id, input)

        setDuplicates(result.duplicates ?? [])
        if (result.fieldErrors) {
          setServerErrors(result.fieldErrors)
        }

        if (result.error) {
          setFormError(result.error)
        }
        if (result.fieldErrors || result.error || result.duplicates?.length) return

        savedToast()
        onSaved()
      } catch {
        setFormError("Could not save this payment.")
      }
    })
  }

  return (
    <>
      <DialogBody className="flex flex-col gap-4">
        {payment ? (
          <div className="flex flex-col gap-1 text-label text-muted-foreground">
            <p>
              {payment.createdByName} · {formatRecordedAt(payment.createdAt)}
            </p>
            <p>
              <Link
                href={`/purchase-orders/${payment.purchaseOrderId}`}
                className="underline underline-offset-4"
              >
                Purchase Order
                {payment.purchaseOrderIssuedOn
                  ? ` · ${formatIsoDate(payment.purchaseOrderIssuedOn)}`
                  : ""}
              </Link>
              {" · Bill"}
              {payment.billIssuedOn ? ` · ${formatIsoDate(payment.billIssuedOn)}` : ""}
              {" · "}
              <Money value={payment.billAmount} />
            </p>
            <p>
              {payment.bankLineDate ? (
                <Link
                  href={`/accounts/bank?account=${payment.bankAccountId}`}
                  className="underline underline-offset-4"
                >
                  Bank Line
                  {payment.bankLineAccount ? ` · ${payment.bankLineAccount}` : ""}
                  {` · ${formatIsoDate(payment.bankLineDate)}`}
                </Link>
              ) : (
                "Bank Line · Not Available"
              )}
            </p>
          </div>
        ) : null}
        <div className="flex flex-col gap-1">
          <Label>Expense Category</Label>
          <p className="text-ui">{categoryName.trim() || "—"}</p>
        </div>
        <RecordPaymentFields
          idPrefix="vendor-payment"
          amount={amount}
          onAmountChange={(value) => {
            setAmount(value)
            setConfirmNotDuplicate(false)
            setDuplicates([])
          }}
          date={paidOn}
          onDateChange={(value) => {
            setPaidOn(value)
            setConfirmNotDuplicate(false)
            setDuplicates([])
          }}
          bankAccountId={bankAccountId}
          onBankAccountIdChange={(value) => {
            setBankAccountId(value)
            setConfirmNotDuplicate(false)
            setDuplicates([])
          }}
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
        <DuplicateWarning
          idPrefix="vendor-payment"
          matches={duplicates}
          confirmed={confirmNotDuplicate}
          onConfirmedChange={setConfirmNotDuplicate}
          reason={duplicateReason}
          onReasonChange={setDuplicateReason}
          reasonError={serverErrors.duplicateReason ?? null}
          disabled={pending}
        />
        {formError ? (
          <p role="alert" className="px-1 text-sm text-destructive md:px-0">
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

