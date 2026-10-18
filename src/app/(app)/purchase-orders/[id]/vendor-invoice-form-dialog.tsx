"use client"

import { useRecordVersion } from "@/lib/use-record-version"
import { savedToast } from "@/lib/saved"
import { useState, useTransition } from "react"

import {
  addVendorInvoice,
  updateVendorInvoice,
  type VendorInvoiceFieldErrors,
} from "@/app/(app)/purchase-orders/[id]/actions"
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
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  isPaymentStatus,
  moneyCents,
  parsePositiveAmount,
  paymentStatusLabel,
  paymentStatuses,
  statusMatchesPayments,
} from "@/lib/payment-status"
import { isIsoDate, todayIsoDate } from "@/lib/project-validation"
import type { VendorInvoiceRow } from "@/lib/vendor-invoice-summary"

export function VendorInvoiceFormDialog({
  open,
  onOpenChange,
  purchaseOrderId,
  invoice,
  maxAmount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchaseOrderId: string
  invoice: VendorInvoiceRow | null
  maxAmount?: number
}) {
  const invoiceId = invoice?.id ?? null
  const version = useRecordVersion("vendor_invoices", invoiceId, open)
  const [issuedOn, setIssuedOn] = useState(invoice?.issuedOn || todayIsoDate())
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : "")
  const [status, setStatus] = useState(invoice?.status ?? "unpaid")
  const [description, setDescription] = useState(invoice?.description ?? "")
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<VendorInvoiceFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const parsedAmount = parsePositiveAmount(amount)
  const paid = invoice?.paid ?? 0
  const exceedsMax =
    status !== "void" &&
    maxAmount !== undefined &&
    parsedAmount !== null &&
    moneyCents(parsedAmount) > moneyCents(maxAmount)
  const issuedError =
    serverErrors.issuedOn ??
    (attempted && !isIsoDate(issuedOn) ? "Enter an issued date." : null)
  const amountError =
    serverErrors.amount ??
    (attempted && parsedAmount === null
      ? amount.trim()
        ? "Enter an amount greater than 0."
        : "Enter an amount."
      : attempted && exceedsMax
        ? "Bills for this purchase order cannot exceed the purchase order value."
        : null)
  const statusError =
    serverErrors.status ??
    (attempted &&
    (!isPaymentStatus(status) ||
      (parsedAmount !== null &&
        !statusMatchesPayments(status, parsedAmount, paid)))
      ? "Status does not match recorded payments. Choose Void to set this payment aside."
      : null)

  const statusItems = paymentStatuses
    .filter((value) => invoiceId !== null || value !== "void")
    .map((value) => ({
      value,
      label: paymentStatusLabel(value),
    }))

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
      !isIsoDate(issuedOn) ||
      parsedAmount === null ||
      exceedsMax ||
      !isPaymentStatus(status) ||
      !statusMatchesPayments(status, parsedAmount, paid)
    ) {
      return
    }

    const input = {
      issuedOn,
      amount: amount.trim(),
      status,
      description: description.trim(),
    }

    startSubmit(async () => {
      try {
        const result = invoiceId
          ? await updateVendorInvoice(invoiceId, { ...input, version })
          : await addVendorInvoice(purchaseOrderId, input)

        if (result.fieldErrors) {
          setServerErrors(result.fieldErrors)
          return
        }

        if (result.error) {
          setFormError(result.error)
          return
        }

        savedToast()
        onOpenChange(false)
      } catch {
        setFormError("Could not save this bill.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="overflow-hidden sm:max-w-lg"
        mobileLayout="nav"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{invoiceId ? "Edit Bill" : "Add Bill"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {invoiceId ? (
            <RecordAttachments parentType="vendor_invoice" parentId={invoiceId} />
          ) : null}
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(issuedError) || undefined}>
              <FieldLabel htmlFor="vendor-invoice-issued">Issue Date</FieldLabel>
              <Input
                id="vendor-invoice-issued"
                type="date"
                value={issuedOn}
                disabled={pending}
                aria-invalid={Boolean(issuedError)}
                onChange={(event) => setIssuedOn(event.target.value)}
              />
              {issuedError ? <FieldError>{issuedError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(amountError) || undefined}>
              <FieldLabel htmlFor="vendor-invoice-amount">Amount</FieldLabel>
              <Input
                id="vendor-invoice-amount"
                inputMode="decimal"
                autoComplete="off"
                value={amount}
                disabled={pending}
                aria-invalid={Boolean(amountError)}
                onChange={(event) => setAmount(event.target.value)}
              />
              {amountError ? <FieldError>{amountError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(statusError) || undefined}>
              <FieldLabel htmlFor="vendor-invoice-status">Status</FieldLabel>
              <Select
                items={statusItems}
                value={status}
                disabled={pending}
                onValueChange={(value) => {
                  if (value && isPaymentStatus(value)) {
                    setStatus(value)
                  }
                }}
              >
                <SelectTrigger
                  id="vendor-invoice-status"
                  className="w-full"
                  aria-invalid={Boolean(statusError)}
                >
                  <SelectValue placeholder="Select A Status" />
                </SelectTrigger>
                <SelectContent align="start">
                  {statusItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {statusError ? <FieldError>{statusError}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="vendor-invoice-description">Description</FieldLabel>
              <Textarea
                id="vendor-invoice-description"
                value={description}
                disabled={pending}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </FieldGroup>
          {formError ? (
            <p role="alert" className="px-1 text-sm text-destructive md:px-0">
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
            {pending ? "Saving…" : invoiceId ? "Save Changes" : "Save Bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
