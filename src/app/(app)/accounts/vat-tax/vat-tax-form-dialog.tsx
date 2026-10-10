"use client"

import { useState, useTransition } from "react"

import {
  addVatTaxPayment,
  type VatTaxFieldErrors,
} from "@/app/(app)/accounts/vat-tax/actions"
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
import type { ProjectOption } from "@/lib/vat-tax"

export function VatTaxFormDialog({
  open,
  onOpenChange,
  projects,
  bankAccounts,
  paymentMethods,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projects: readonly ProjectOption[]
  bankAccounts: readonly BankAccountChoice[]
  paymentMethods: readonly string[]
}) {
  const [projectId, setProjectId] = useState("")
  const [paidOn, setPaidOn] = useState("")
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("")
  const [notes, setNotes] = useState("")
  const [bankAccountId, setBankAccountId] = useState(
    defaultBankAccountId(bankAccounts, ""),
  )

  const [fieldErrors, setFieldErrors] = useState<VatTaxFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const projItems = projects.map((p) => ({ value: p.id, label: p.name }))

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setFormError(null)
    setFieldErrors({})

    const input = {
      projectId,
      paidOn: paidOn.trim(),
      amount: amount.trim(),
      paymentMethod,
      notes: notes.trim(),
      bankAccountId,
      newAccountName: "",
      newBankName: "",
    }

    startSubmit(async () => {
      try {
        const result = await addVatTaxPayment(input)
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
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
        className="overflow-hidden sm:max-w-md"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>Add VAT / Tax Payment</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="vat-project">Project</Label>
            <Select
              items={projItems}
              value={projectId || null}
              disabled={pending}
              onValueChange={(v) => setProjectId(v ?? "")}
            >
              <SelectTrigger
                id="vat-project"
                className="w-full"
                aria-invalid={Boolean(fieldErrors.projectId)}
              >
                <SelectValue placeholder="Select Project" />
              </SelectTrigger>
              <SelectContent align="start">
                {projItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.projectId ? (
              <p role="alert" className="text-sm text-destructive">
                {fieldErrors.projectId}
              </p>
            ) : null}
          </div>
          <RecordPaymentFields
            idPrefix="vat"
            amount={amount}
            onAmountChange={setAmount}
            date={paidOn}
            onDateChange={setPaidOn}
            bankAccountId={bankAccountId}
            onBankAccountIdChange={setBankAccountId}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            notes={notes}
            onNotesChange={setNotes}
            accounts={bankAccounts}
            paymentMethods={paymentMethods}
            disabled={pending}
            amountError={fieldErrors.amount ?? null}
            dateError={fieldErrors.paidOn ?? null}
            accountError={fieldErrors.bankAccountId ?? null}
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
