"use client"

import { useState, useTransition } from "react"

import {
  addClientInvoice,
  updateClientInvoice,
  type ClientInvoiceFieldErrors,
} from "@/app/(app)/accounts/invoices/actions"
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
import {
  defaultBankAccountId,
  type BankAccountChoice,
} from "@/lib/bank-account"
import type {
  ClientInvoiceRow,
  InvoiceProjectOption,
} from "@/lib/client-invoice-summary"
import {
  clientInvoiceStatusLabel,
  clientInvoiceStatuses,
  defaultClientInvoiceStatus,
  isClientInvoiceStatus,
} from "@/lib/payment-status"
import { isIsoDate, parseProjectValue, todayIsoDate } from "@/lib/project-validation"

export function ClientInvoiceFormDialog({
  open,
  onOpenChange,
  invoice,
  projects,
  bankAccounts,
  defaultProjectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: ClientInvoiceRow | null
  projects: InvoiceProjectOption[]
  bankAccounts: readonly BankAccountChoice[]
  defaultProjectId: string | null
}) {
  const invoiceId = invoice?.id ?? null
  const [issuedOn, setIssuedOn] = useState(invoice?.issuedOn || todayIsoDate())
  const [dueOn, setDueOn] = useState(invoice?.dueOn ?? "")
  const [projectId, setProjectId] = useState(
    invoice?.projectId ?? defaultProjectId ?? "",
  )
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : "")
  const [status, setStatus] = useState(
    invoice?.status ?? defaultClientInvoiceStatus,
  )
  const [bankAccountId, setBankAccountId] = useState(
    defaultBankAccountId(bankAccounts, ""),
  )
  const [accountName, setAccountName] = useState("Operating account")
  const [bankName, setBankName] = useState("")
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<ClientInvoiceFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const parsedAmount = parseProjectValue(amount)
  const projectItems = projects.map((item) => ({
    value: item.id,
    label: item.name || "—",
  }))
  const statusItems = clientInvoiceStatuses.map((value) => ({
    value,
    label: clientInvoiceStatusLabel(value),
  }))
  const needsBankAccount =
    status === "paid" && (invoice ? invoice.balance > 0 : true)
  const hasAccounts =
    bankAccounts.some((account) => account.isActive) || Boolean(bankAccountId)
  const dueError =
    serverErrors.dueOn ??
    (attempted && dueOn.trim() !== "" && !isIsoDate(dueOn)
      ? "Enter a due date."
      : null)
  const accountError = serverErrors.bankAccountId ?? null
  const issuedError =
    serverErrors.issuedOn ??
    (attempted && !isIsoDate(issuedOn) ? "Enter an issue date." : null)
  const projectError =
    serverErrors.projectId ??
    (attempted && !projectId ? "Choose a project." : null)
  const amountError =
    serverErrors.amount ??
    (attempted && (parsedAmount === null || parsedAmount <= 0)
      ? amount.trim()
        ? "Enter an amount greater than 0."
        : "Enter an amount."
      : null)
  const statusError =
    serverErrors.status ??
    (attempted && !isClientInvoiceStatus(status) ? "Choose a status." : null)

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
      (dueOn.trim() !== "" && !isIsoDate(dueOn)) ||
      !projectId ||
      parsedAmount === null ||
      parsedAmount <= 0 ||
      !isClientInvoiceStatus(status)
    ) {
      return
    }

    if (needsBankAccount && hasAccounts && !bankAccountId) {
      setServerErrors({ bankAccountId: "Choose a bank account." })
      return
    }

    if (needsBankAccount && !hasAccounts && !accountName.trim()) {
      setServerErrors({ bankAccountId: "Enter an account name." })
      return
    }

    const input = {
      projectId,
      issuedOn,
      dueOn: dueOn.trim(),
      amount: amount.trim(),
      status,
      bankAccountId: needsBankAccount ? bankAccountId : "",
      newAccountName: needsBankAccount && !hasAccounts ? accountName.trim() : "",
      newBankName: needsBankAccount && !hasAccounts ? bankName.trim() : "",
    }

    startSubmit(async () => {
      try {
        const result = invoiceId
          ? await updateClientInvoice(invoiceId, input)
          : await addClientInvoice(input)

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
        setFormError("Could not save this invoice.")
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
            {invoiceId ? "Edit Client Invoice" : "Add Client Invoice"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-invoice-issued">Issue Date</Label>
            <Input
              id="client-invoice-issued"
              type="date"
              value={issuedOn}
              disabled={pending}
              aria-invalid={Boolean(issuedError)}
              onChange={(event) => setIssuedOn(event.target.value)}
            />
            {issuedError ? (
              <p role="alert" className="text-sm text-destructive">
                {issuedError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-invoice-due">Due Date</Label>
            <Input
              id="client-invoice-due"
              type="date"
              value={dueOn}
              disabled={pending}
              aria-invalid={Boolean(dueError)}
              onChange={(event) => setDueOn(event.target.value)}
            />
            {dueError ? (
              <p role="alert" className="text-sm text-destructive">
                {dueError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-invoice-project">Project</Label>
            <Select
              items={projectItems}
              value={projectId || null}
              disabled={pending}
              onValueChange={(value) => setProjectId(value ?? "")}
            >
              <SelectTrigger
                id="client-invoice-project"
                className="w-full"
                aria-invalid={Boolean(projectError)}
              >
                <SelectValue placeholder="Select A Project" />
              </SelectTrigger>
              <SelectContent align="start">
                {projectItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {projectError ? (
              <p role="alert" className="text-sm text-destructive">
                {projectError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="client-invoice-amount">Amount</Label>
              <Input
                id="client-invoice-amount"
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
              <Label htmlFor="client-invoice-status">Status</Label>
              <Select
                items={statusItems}
                value={status}
                disabled={pending}
                onValueChange={(value) => {
                  if (value && isClientInvoiceStatus(value)) {
                    setStatus(value)
                  }
                }}
              >
                <SelectTrigger
                  id="client-invoice-status"
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
              {statusError ? (
                <p role="alert" className="text-sm text-destructive">
                  {statusError}
                </p>
              ) : null}
            </div>
          </div>
          {needsBankAccount ? (
            <BankAccountField
              idPrefix="client-invoice"
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
          ) : null}
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
            {pending ? "Saving…" : invoiceId ? "Save Changes" : "Save Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
