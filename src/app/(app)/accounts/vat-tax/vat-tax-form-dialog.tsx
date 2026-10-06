"use client"

import { useState, useTransition } from "react"

import {
  addVatTaxPayment,
  type VatTaxFieldErrors,
} from "@/app/(app)/accounts/vat-tax/actions"
import { BankAccountField } from "@/components/bank-account-field"
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
  const [newAccountName, setNewAccountName] = useState("")
  const [newBankName, setNewBankName] = useState("")

  const [fieldErrors, setFieldErrors] = useState<VatTaxFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const projItems = projects.map((p) => ({ value: p.id, label: p.name }))
  const pmItems = paymentMethods.map((pm) => ({ value: pm, label: pm }))

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
      newAccountName: newAccountName.trim(),
      newBankName: newBankName.trim(),
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="vat-paid">Paid On</Label>
              <Input
                id="vat-paid"
                type="date"
                value={paidOn}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.paidOn)}
                onChange={(e) => setPaidOn(e.target.value)}
              />
              {fieldErrors.paidOn ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.paidOn}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vat-amount">Amount</Label>
              <Input
                id="vat-amount"
                type="number"
                step="0.01"
                value={amount}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.amount)}
                onChange={(e) => setAmount(e.target.value)}
              />
              {fieldErrors.amount ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.amount}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vat-method">Payment Method</Label>
            <Select
              items={pmItems}
              value={paymentMethod || null}
              disabled={pending}
              onValueChange={(v) => setPaymentMethod(v ?? "")}
            >
              <SelectTrigger id="vat-method" className="w-full">
                <SelectValue placeholder="Select Method" />
              </SelectTrigger>
              <SelectContent align="start">
                {pmItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <BankAccountField
            idPrefix="vat"
            accounts={bankAccounts}
            accountId={bankAccountId}
            onAccountIdChange={setBankAccountId}
            accountName={newAccountName}
            onAccountNameChange={setNewAccountName}
            bankName={newBankName}
            onBankNameChange={setNewBankName}
            disabled={pending}
            error={fieldErrors.bankAccountId ?? null}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="vat-notes">Notes</Label>
            <Textarea
              id="vat-notes"
              value={notes}
              disabled={pending}
              onChange={(e) => setNotes(e.target.value)}
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
