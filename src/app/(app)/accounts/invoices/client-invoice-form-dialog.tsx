"use client"

import { useState, useTransition } from "react"

import {
  addClientInvoice,
  updateClientInvoice,
  type ClientInvoiceFieldErrors,
} from "@/app/(app)/accounts/invoices/actions"
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
  defaultProjectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  invoice: ClientInvoiceRow | null
  projects: InvoiceProjectOption[]
  defaultProjectId: string | null
}) {
  const invoiceId = invoice?.id ?? null
  const [issuedOn, setIssuedOn] = useState(invoice?.issuedOn || todayIsoDate())
  const [projectId, setProjectId] = useState(
    invoice?.projectId ?? defaultProjectId ?? "",
  )
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : "")
  const [status, setStatus] = useState(
    invoice?.status ?? defaultClientInvoiceStatus,
  )
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
      !projectId ||
      parsedAmount === null ||
      parsedAmount <= 0 ||
      !isClientInvoiceStatus(status)
    ) {
      return
    }

    const input = {
      projectId,
      issuedOn,
      amount: amount.trim(),
      status,
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
