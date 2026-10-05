"use client"

import { useState, useTransition } from "react"

import {
  addPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderFormFieldErrors,
} from "@/app/(app)/purchase-orders/actions"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
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
import {
  isIsoDate,
  parseProjectValue,
  todayIsoDate,
} from "@/lib/project-validation"
import type {
  ProjectOption,
  PurchaseOrderRow,
  VendorOption,
} from "@/lib/purchase-order-summary"

export function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  purchaseOrder,
  projects,
  vendors,
  workTypes,
  defaultProjectId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchaseOrder: PurchaseOrderRow | null
  projects: ProjectOption[]
  vendors: VendorOption[]
  workTypes: readonly string[]
  defaultProjectId: string | null
}) {
  const purchaseOrderId = purchaseOrder?.id ?? null
  const [projectId, setProjectId] = useState(
    purchaseOrder?.projectId ?? defaultProjectId ?? "",
  )
  const [vendorId, setVendorId] = useState(purchaseOrder?.vendorId ?? "")
  const [issuedOn, setIssuedOn] = useState(
    purchaseOrder?.issuedOn || todayIsoDate(),
  )
  const [workType, setWorkType] = useState(purchaseOrder?.workType ?? "")
  const [totalValue, setTotalValue] = useState(
    purchaseOrder ? String(purchaseOrder.totalValue) : "",
  )
  const [notes, setNotes] = useState(purchaseOrder?.notes ?? "")
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<PurchaseOrderFormFieldErrors>(
    {},
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const projectItems = projects.map((project) => ({
    value: project.id,
    label: project.name || "—",
  }))
  const vendorItems = vendors.map((vendor) => ({
    value: vendor.id,
    label: vendor.displayName || "—",
  }))
  const projectError =
    serverErrors.projectId ??
    (attempted && !projectId ? "Choose a project." : null)
  const vendorError =
    serverErrors.vendorId ??
    (attempted && !vendorId ? "Choose a vendor." : null)
  const dateError =
    serverErrors.issuedOn ??
    (attempted && !isIsoDate(issuedOn) ? "Enter a date." : null)
  const valueError =
    serverErrors.totalValue ??
    (attempted && parseProjectValue(totalValue) === null
      ? totalValue.trim()
        ? "Enter a purchase order value of 0 or more."
        : "Enter a purchase order value."
      : null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) {
      return
    }

    onOpenChange(nextOpen)
  }

  function handleWorkTypeInput(
    next: string,
    details: { reason: string; cancel: () => void },
  ) {
    if (details.reason === "input-change" || details.reason === "item-press") {
      setWorkType(next)
      return
    }

    // Closing the list snaps unmatched text back to the last picked item.
    // Vendor Work Type may be new text, so keep what was typed.
    details.cancel()
  }

  function handleSubmit() {
    setAttempted(true)
    setServerErrors({})
    setFormError(null)

    const parsedValue = parseProjectValue(totalValue)
    if (!projectId || !vendorId || !isIsoDate(issuedOn) || parsedValue === null) {
      return
    }

    const input = {
      projectId,
      vendorId,
      issuedOn,
      workType: workType.trim(),
      totalValue: totalValue.trim(),
      notes: notes.trim(),
    }

    startSubmit(async () => {
      try {
        const result = purchaseOrderId
          ? await updatePurchaseOrder(purchaseOrderId, input)
          : await addPurchaseOrder(input)

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
        setFormError("Could not save this purchase order.")
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
            {purchaseOrderId ? "Edit purchase order" : "Assign Purchase Order"}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="po-project">Project</Label>
            <Select
              items={projectItems}
              value={projectId || null}
              disabled={pending}
              onValueChange={(value) => setProjectId(value ?? "")}
            >
              <SelectTrigger
                id="po-project"
                className="w-full"
                aria-invalid={Boolean(projectError)}
              >
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent align="start">
                {projectItems.map((project) => (
                  <SelectItem key={project.value} value={project.value}>
                    {project.label}
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="po-vendor">Vendor</Label>
            <Select
              items={vendorItems}
              value={vendorId || null}
              disabled={pending}
              onValueChange={(value) => setVendorId(value ?? "")}
            >
              <SelectTrigger
                id="po-vendor"
                className="w-full"
                aria-invalid={Boolean(vendorError)}
              >
                <SelectValue placeholder="Select a vendor" />
              </SelectTrigger>
              <SelectContent align="start">
                {vendorItems.map((vendor) => (
                  <SelectItem key={vendor.value} value={vendor.value}>
                    {vendor.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vendorError ? (
              <p role="alert" className="text-sm text-destructive">
                {vendorError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="po-issued-on">Date</Label>
              <Input
                id="po-issued-on"
                type="date"
                value={issuedOn}
                disabled={pending}
                aria-invalid={Boolean(dateError)}
                onChange={(event) => setIssuedOn(event.target.value)}
              />
              {dateError ? (
                <p role="alert" className="text-sm text-destructive">
                  {dateError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="po-total-value">Purchase Order Value</Label>
              <Input
                id="po-total-value"
                inputMode="decimal"
                value={totalValue}
                disabled={pending}
                aria-invalid={Boolean(valueError)}
                onChange={(event) => setTotalValue(event.target.value)}
              />
              {valueError ? (
                <p role="alert" className="text-sm text-destructive">
                  {valueError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="po-work-type">Vendor Work Type</Label>
            <Combobox
              autoComplete="off"
              items={workTypes}
              inputValue={workType}
              onInputValueChange={handleWorkTypeInput}
              onValueChange={(value) => {
                if (typeof value === "string") {
                  setWorkType(value)
                }
              }}
            >
              <ComboboxInput
                id="po-work-type"
                className="w-full"
                disabled={pending}
              />
              <ComboboxContent className="data-empty:hidden">
                <ComboboxList>
                  {(item: string) => (
                    <ComboboxItem key={item} value={item}>
                      {item}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="po-notes">Notes</Label>
            <Textarea
              id="po-notes"
              value={notes}
              disabled={pending}
              onChange={(event) => setNotes(event.target.value)}
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
            {pending
              ? "Saving…"
              : purchaseOrderId
                ? "Save changes"
                : "Save purchase order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
