"use client"

import { useState, useTransition } from "react"

import {
  addPayrollRun,
  updatePayrollRun,
  type PayrollRunFieldErrors,
} from "@/app/(app)/hr/payroll/actions"
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
import type { BankAccountChoice } from "@/lib/bank-account"
import { defaultBankAccountId } from "@/lib/bank-account"
import type { PayrollRunRow } from "@/lib/payroll"

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const statusItems = [
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
]

const monthItems = monthNames.map((name, i) => ({
  value: String(i + 1),
  label: name,
}))

export function PayrollRunFormDialog({
  open,
  onOpenChange,
  run,
  bankAccounts,
  paymentMethods,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  run: PayrollRunRow | null
  bankAccounts: readonly BankAccountChoice[]
  paymentMethods: readonly string[]
  onCreated?: (id: string) => void
}) {
  const runId = run?.id ?? null
  const now = new Date()
  const [periodYear, setPeriodYear] = useState(
    String(run?.periodYear ?? now.getFullYear()),
  )
  const [periodMonth, setPeriodMonth] = useState(
    String(run?.periodMonth ?? now.getMonth() + 1),
  )
  const [paidOn, setPaidOn] = useState(run?.paidOn ?? "")
  const [status, setStatus] = useState(run?.status ?? "draft")
  const [notes, setNotes] = useState(run?.notes ?? "")
  const [bankAccountId, setBankAccountId] = useState(
    defaultBankAccountId(bankAccounts, run?.bankAccountId ?? ""),
  )
  const [paymentMethod, setPaymentMethod] = useState(run?.paymentMethod ?? "")

  const [fieldErrors, setFieldErrors] = useState<PayrollRunFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setFormError(null)
    setFieldErrors({})

    const input = {
      periodYear,
      periodMonth,
      paidOn: paidOn.trim(),
      status,
      notes: notes.trim(),
      bankAccountId,
      paymentMethod,
    }

    startSubmit(async () => {
      try {
        const result = runId
          ? await updatePayrollRun(runId, input)
          : await addPayrollRun(input)

        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
          return
        }
        if (result.error) {
          setFormError(result.error)
          return
        }
        onOpenChange(false)
        if (!runId && result.id && onCreated) onCreated(result.id)
      } catch {
        setFormError("Could not save this payroll run.")
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
          <DialogTitle>
            {runId ? "Edit Payroll Run" : "New Payroll Run"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pr-year">Year</Label>
              <Input
                id="pr-year"
                type="number"
                value={periodYear}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.periodYear)}
                onChange={(e) => setPeriodYear(e.target.value)}
              />
              {fieldErrors.periodYear ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.periodYear}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pr-month">Month</Label>
              <Select
                items={monthItems}
                value={periodMonth}
                disabled={pending}
                onValueChange={(v) => setPeriodMonth(v ?? "")}
              >
                <SelectTrigger id="pr-month" className="w-full">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent align="start">
                  {monthItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.periodMonth ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.periodMonth}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pr-paid">Paid On</Label>
              <Input
                id="pr-paid"
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
              <Label htmlFor="pr-status">Status</Label>
              <Select
                items={statusItems}
                value={status}
                disabled={pending}
                onValueChange={(v) => setStatus(v ?? "draft")}
              >
                <SelectTrigger id="pr-status" className="w-full">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent align="start">
                  {statusItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {status === "paid" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pr-account">Bank Account</Label>
                {bankAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Add a bank account in Settings before marking this run paid.
                  </p>
                ) : (
                  <Select
                    items={bankAccounts.map((account) => ({
                      value: account.id,
                      label: account.name || "Account",
                    }))}
                    value={bankAccountId}
                    disabled={pending}
                    onValueChange={(value) => setBankAccountId(value ?? "")}
                  >
                    <SelectTrigger
                      id="pr-account"
                      className="w-full"
                      aria-invalid={Boolean(fieldErrors.bankAccountId)}
                    >
                      <SelectValue placeholder="Choose An Account" />
                    </SelectTrigger>
                    <SelectContent align="start">
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name || "Account"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {fieldErrors.bankAccountId ? (
                  <p role="alert" className="text-sm text-destructive">
                    {fieldErrors.bankAccountId}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pr-method">Payment Method</Label>
                <NameCombobox
                  id="pr-method"
                  value={paymentMethod}
                  names={paymentMethods}
                  disabled={pending}
                  placeholder="Search Payment Methods"
                  onValueChange={setPaymentMethod}
                />
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="pr-notes">Notes</Label>
            <Textarea
              id="pr-notes"
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
            {pending ? "Saving…" : runId ? "Save Changes" : "Create Run"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
