"use client"

import { savedToast } from "@/lib/saved"
import Link from "next/link"
import { useState, useTransition } from "react"

import {
  addVatTaxPayment,
  type VatTaxFieldErrors,
} from "@/app/(app)/accounts/vat-tax/actions"
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

  const projItems = projects.map((project) => ({ value: project.id, label: project.name }))
  const choices = bankAccounts.filter(
    (account) => account.isActive || account.id === bankAccountId,
  )
  const accountItems = choices.map((account) => ({
    value: account.id,
    label: account.name || "Account",
  }))

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
        }
        if (result.error) {
          setFormError(result.error)
        }
        if (result.fieldErrors || result.error) return
        savedToast()
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
        mobileLayout="nav"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>Add VAT / Tax Payment</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(fieldErrors.projectId) || undefined}>
              <FieldLabel htmlFor="vat-project">Project</FieldLabel>
              <Select
                items={projItems}
                value={projectId || null}
                disabled={pending}
                onValueChange={(value) => setProjectId(value ?? "")}
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
              {fieldErrors.projectId ? <FieldError>{fieldErrors.projectId}</FieldError> : null}
            </Field>

            <Field span="half" data-invalid={Boolean(fieldErrors.amount) || undefined}>
              <FieldLabel htmlFor="vat-amount">Amount</FieldLabel>
              <Input
                id="vat-amount"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="next"
                value={amount}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.amount)}
                onChange={(event) => setAmount(event.target.value)}
              />
              {fieldErrors.amount ? <FieldError>{fieldErrors.amount}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.paidOn) || undefined}>
              <FieldLabel htmlFor="vat-date">Date</FieldLabel>
              <Input
                id="vat-date"
                type="date"
                enterKeyHint="next"
                value={paidOn}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.paidOn)}
                onChange={(event) => setPaidOn(event.target.value)}
              />
              {fieldErrors.paidOn ? <FieldError>{fieldErrors.paidOn}</FieldError> : null}
            </Field>

            {choices.length === 0 ? (
              <Field data-invalid={Boolean(fieldErrors.bankAccountId) || undefined}>
                <p className="text-sm font-medium">Add Your First Bank Account</p>
                <p className="text-sm text-muted-foreground">
                  Payments Need A Bank Account. Add One In Settings Before Saving.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full md:w-fit"
                  render={<Link href="/settings/bank" />}
                >
                  Open Settings
                </Button>
                {fieldErrors.bankAccountId ? (
                  <FieldError>{fieldErrors.bankAccountId}</FieldError>
                ) : null}
              </Field>
            ) : (
              <Field data-invalid={Boolean(fieldErrors.bankAccountId) || undefined}>
                <FieldLabel htmlFor="vat-account">Bank Account</FieldLabel>
                <Select
                  items={accountItems}
                  value={bankAccountId}
                  disabled={pending}
                  onValueChange={(value) => setBankAccountId(value ?? "")}
                >
                  <SelectTrigger
                    id="vat-account"
                    className="w-full"
                    aria-invalid={Boolean(fieldErrors.bankAccountId)}
                  >
                    <SelectValue placeholder="Choose An Account" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {accountItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.bankAccountId ? (
                  <FieldError>{fieldErrors.bankAccountId}</FieldError>
                ) : null}
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="vat-method">Payment Method</FieldLabel>
              <NameCombobox
                id="vat-method"
                value={paymentMethod}
                names={paymentMethods}
                disabled={pending}
                placeholder="Search Payment Methods"
                onValueChange={setPaymentMethod}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="vat-notes">Notes</FieldLabel>
              <Textarea
                maxLength={1000}
                id="vat-notes"
                value={notes}
                disabled={pending}
                onChange={(event) => setNotes(event.target.value)}
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
            {pending ? "Saving…" : "Save Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
