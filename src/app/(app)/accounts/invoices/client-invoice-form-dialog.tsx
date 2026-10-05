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
import { Textarea } from "@/components/ui/textarea"
import type {
  ClientInvoiceRow,
  InvoiceProjectOption,
} from "@/lib/client-invoice-summary"
import {
  isPaymentStatus,
  paymentStatusLabel,
  paymentStatuses,
  statusMatchesPayments,
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
  const [projectId, setProjectId] = useState(
    invoice?.projectId ?? defaultProjectId ?? "",
  )
  const [issuedOn, setIssuedOn] = useState(invoice?.issuedOn || todayIsoDate())
  const [dueOn, setDueOn] = useState(invoice?.dueOn ?? "")
  const [amount, setAmount] = useState(invoice ? String(invoice.amount) : "")
  const [status, setStatus] = useState(invoice?.status ?? "unpaid")
  const [description, setDescription] = useState(invoice?.description ?? "")
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<ClientInvoiceFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const project = projects.find((item) => item.id === projectId) ?? null
  const parsedAmount = parseProjectValue(amount)
  const paid = invoice?.paid ?? 0
  const projectItems = projects.map((item) => ({
    value: item.id,
    label: item.name || "—",
  }))
  const statusItems = paymentStatuses.map((value) => ({
    value,
    label: paymentStatusLabel(value),
  }))
  const projectError =
    serverErrors.projectId ??
    (attempted && !projectId ? "Choose a project." : null)
  const issuedError =
    serverErrors.issuedOn ??
    (attempted && !isIsoDate(issuedOn) ? "Enter an issued date." : null)
  const dueError =
    serverErrors.dueOn ??
    (attempted && dueOn.trim() && !isIsoDate(dueOn) ? "Enter a due date." : null)
  const amountError =
    serverErrors.amount ??
    (attempted && parsedAmount === null
      ? amount.trim()
        ? "Enter an amount of 0 or more."
        : "Enter an amount."
      : null)
  const statusError =
    serverErrors.status ??
    (attempted &&
    (!isPaymentStatus(status) ||
      (parsedAmount !== null &&
        !statusMatchesPayments(status, parsedAmount, paid)))
      ? "Status does not match recorded payments. Choose Void to set the invoice aside."
      : null)

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
      !projectId ||
      !isIsoDate(issuedOn) ||
      (dueOn.trim() && !isIsoDate(dueOn)) ||
      parsedAmount === null ||
      !isPaymentStatus(status) ||
      !statusMatchesPayments(status, parsedAmount, paid)
    ) {
      return
    }

    const input = {
      projectId,
      issuedOn,
      dueOn: dueOn.trim(),
      amount: amount.trim(),
      status,
      description: description.trim(),
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
            {invoiceId ? "Edit client invoice" : "Add client invoice"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
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
                <SelectValue placeholder="Select a project" />
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
            <p className="text-sm text-muted-foreground">
              Client: {project?.clientName || "—"}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="client-invoice-issued">Issued</Label>
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
              <Label htmlFor="client-invoice-due">Due</Label>
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
                  if (value && isPaymentStatus(value)) {
                    setStatus(value)
                  }
                }}
              >
                <SelectTrigger
                  id="client-invoice-status"
                  className="w-full"
                  aria-invalid={Boolean(statusError)}
                >
                  <SelectValue placeholder="Select a status" />
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="client-invoice-description">Description</Label>
            <Textarea
              id="client-invoice-description"
              value={description}
              disabled={pending}
              onChange={(event) => setDescription(event.target.value)}
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
            {pending ? "Saving…" : invoiceId ? "Save changes" : "Save invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
