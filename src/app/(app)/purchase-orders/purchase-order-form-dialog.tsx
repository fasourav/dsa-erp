"use client"

import { useRecordVersion } from "@/lib/use-record-version"
import { savedToast } from "@/lib/saved"
import { useState, useTransition } from "react"

import {
  addPurchaseOrder,
  updatePurchaseOrder,
  type PurchaseOrderFormFieldErrors,
} from "@/app/(app)/purchase-orders/actions"
import { MoneyInput } from "@/components/money-input"
import { RecordPicker } from "@/components/record-picker"
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
import {
  Field,
  FieldDescription,
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
  isIsoDate,
  amountError,
  parseProjectValue,
  todayIsoDate,
} from "@/lib/project-validation"
import type {
  ExpenseCategoryOption,
  ProjectOption,
  PurchaseOrderRow,
  VendorOption,
  VendorPoDefaults,
} from "@/lib/purchase-order-summary"
import { countsAsLabel, isReportGroup, keywordReportGroup } from "@/lib/report-cost-group"

export function PurchaseOrderFormDialog({
  open,
  onOpenChange,
  purchaseOrder,
  projects,
  vendors,
  workTypes,
  expenseCategories,
  officeExpenseCategories,
  vendorDefaults = {},
  defaultProjectId,
  operational = false,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  purchaseOrder: PurchaseOrderRow | null
  projects: ProjectOption[]
  vendors: VendorOption[]
  workTypes: readonly string[]
  expenseCategories: readonly ExpenseCategoryOption[]
  officeExpenseCategories: readonly ExpenseCategoryOption[]
  vendorDefaults?: VendorPoDefaults
  defaultProjectId: string | null
  operational?: boolean
}) {
  const purchaseOrderId = purchaseOrder?.id ?? null
  const version = useRecordVersion("vendor_purchase_orders", purchaseOrderId, open)
  const [projectId, setProjectId] = useState(
    operational ? "" : (purchaseOrder?.projectId ?? defaultProjectId ?? ""),
  )
  const [vendorId, setVendorId] = useState(purchaseOrder?.vendorId ?? "")
  const [issuedOn, setIssuedOn] = useState(
    purchaseOrder?.issuedOn || todayIsoDate(),
  )
  const [workType, setWorkType] = useState(purchaseOrder?.workType ?? "")
  const [expenseCategoryId, setExpenseCategoryId] = useState(
    purchaseOrder?.expenseCategoryId ?? "",
  )
  const [officeExpenseCategoryId, setOfficeExpenseCategoryId] = useState(
    purchaseOrder?.officeExpenseCategoryId ?? "",
  )
  const [totalValue, setTotalValue] = useState(
    purchaseOrder ? String(purchaseOrder.totalValue) : "",
  )
  const [notes, setNotes] = useState(purchaseOrder?.notes ?? "")
  const [autoFilled, setAutoFilled] = useState<{
    expense?: string
    office?: string
    workType?: string
  }>({})
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<PurchaseOrderFormFieldErrors>(
    {},
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const categoryChoices =
    expenseCategoryId &&
    !expenseCategories.some((category) => category.id === expenseCategoryId)
      ? [
          ...expenseCategories,
          {
            id: expenseCategoryId,
            name: purchaseOrder?.expenseCategoryName || "Saved Category",
          },
        ]
      : expenseCategories
  const categoryItems = categoryChoices.map((category) => ({
    value: category.id,
    label: category.name,
  }))
  const officeChoices =
    officeExpenseCategoryId &&
    !officeExpenseCategories.some((category) => category.id === officeExpenseCategoryId)
      ? [
          ...officeExpenseCategories,
          {
            id: officeExpenseCategoryId,
            name: purchaseOrder?.officeExpenseCategoryName || "Saved Category",
          },
        ]
      : officeExpenseCategories
  const officeItems = officeChoices.map((category) => ({
    value: category.id,
    label: category.name,
  }))
  const selectedOffice = officeChoices.find(
    (category) => category.id === officeExpenseCategoryId,
  )
  const officeCountsAs = selectedOffice
    ? countsAsLabel(
        isReportGroup(selectedOffice.reportGroup)
          ? selectedOffice.reportGroup
          : keywordReportGroup(selectedOffice.name),
      )
    : null
  const projectItems = projects.map((project) => ({
    value: project.id,
    label: project.name || "—",
  }))
  const vendorItems = vendors.map((vendor) => ({
    value: vendor.id,
    label: vendor.displayName || "—",
  }))
  const projectError = operational
    ? null
    : (serverErrors.projectId ??
      (attempted && !projectId ? "Choose a project." : null))
  const vendorError =
    serverErrors.vendorId ??
    (attempted && !vendorId ? "Choose a vendor." : null)
  const dateError =
    serverErrors.issuedOn ??
    (attempted && !isIsoDate(issuedOn) ? "Enter a date." : null)
  const categoryError = operational
    ? null
    : (serverErrors.expenseCategoryId ??
      (attempted && !purchaseOrderId && !expenseCategoryId
        ? "Choose a project expense category."
        : null))
  const officeCategoryError = operational
    ? (serverErrors.officeExpenseCategoryId ??
      (attempted && !purchaseOrderId && !officeExpenseCategoryId
        ? "Choose an office expense category."
        : null))
    : null
  const valueError =
    serverErrors.totalValue ??
    (attempted && parseProjectValue(totalValue) === null
      ? totalValue.trim()
        ? amountError(totalValue, "purchase order value")
        : "Enter a purchase order value."
      : null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) {
      return
    }

    onOpenChange(nextOpen)
  }

  function handleVendorChange(nextVendorId: string) {
    setVendorId(nextVendorId)
    if (purchaseOrderId !== null) return

    const defaults = nextVendorId ? vendorDefaults[nextVendorId] : undefined
    const nextAuto: { expense?: string; office?: string; workType?: string } = {
      ...autoFilled,
    }

    if (operational) {
      if (
        !officeExpenseCategoryId ||
        officeExpenseCategoryId === autoFilled.office
      ) {
        const nextOffice = defaults?.officeExpenseCategoryId ?? ""
        setOfficeExpenseCategoryId(nextOffice)
        nextAuto.office = nextOffice || undefined
      }
    } else {
      if (
        !expenseCategoryId ||
        expenseCategoryId === autoFilled.expense
      ) {
        const nextExpense = defaults?.expenseCategoryId ?? ""
        setExpenseCategoryId(nextExpense)
        nextAuto.expense = nextExpense || undefined
      }
    }

    if (!workType.trim() || workType === autoFilled.workType) {
      const nextWorkType = defaults?.workType ?? ""
      setWorkType(nextWorkType)
      nextAuto.workType = nextWorkType || undefined
    }

    setAutoFilled(nextAuto)
  }

  function handleWorkTypeInput(
    next: string,
    details: { reason: string; cancel: () => void },
  ) {
    if (details.reason === "input-change" || details.reason === "item-press") {
      setWorkType(next)
      setAutoFilled((prev) => ({ ...prev, workType: undefined }))
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
    if (
      (!operational && !projectId) ||
      (!operational && !purchaseOrderId && !expenseCategoryId) ||
      (operational && !purchaseOrderId && !officeExpenseCategoryId) ||
      !vendorId ||
      !isIsoDate(issuedOn) ||
      parsedValue === null
    ) {
      return
    }

    const input = {
      projectId: operational ? "" : projectId,
      vendorId,
      issuedOn,
      workType: workType.trim(),
      expenseCategoryId: operational ? "" : expenseCategoryId,
      officeExpenseCategoryId: operational ? officeExpenseCategoryId : "",
      totalValue: totalValue.trim(),
      notes: notes.trim(),
    }

    startSubmit(async () => {
      try {
        const result = purchaseOrderId
          ? await updatePurchaseOrder(purchaseOrderId, { ...input, version })
          : await addPurchaseOrder(input)

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
        setFormError("Could not save this purchase order.")
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
          <DialogTitle>
            {operational
              ? purchaseOrderId
                ? "Edit Operational Purchase Order"
                : "Add Operational Purchase Order"
              : purchaseOrderId
                ? "Edit Purchase Order"
                : "Assign Purchase Order"}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <FieldGroup layout="inset">
            {operational ? null : (
              <Field data-invalid={Boolean(projectError) || undefined}>
                <FieldLabel htmlFor="po-project">Project</FieldLabel>
                <RecordPicker
                  id="po-project"
                  value={projectId}
                  options={projectItems}
                  placeholder="Select A Project"
                  disabled={pending}
                  invalid={Boolean(projectError)}
                  onValueChange={setProjectId}
                />
                {projectError ? <FieldError>{projectError}</FieldError> : null}
              </Field>
            )}

            <Field data-invalid={Boolean(vendorError) || undefined}>
              <FieldLabel htmlFor="po-vendor">Vendor</FieldLabel>
              <RecordPicker
                id="po-vendor"
                value={vendorId}
                options={vendorItems}
                placeholder="Select A Vendor"
                disabled={pending}
                invalid={Boolean(vendorError)}
                onValueChange={handleVendorChange}
              />
              {vendorError ? <FieldError>{vendorError}</FieldError> : null}
            </Field>

            <Field span="half" data-invalid={Boolean(dateError) || undefined}>
              <FieldLabel htmlFor="po-issued-on">Date</FieldLabel>
              <Input
                id="po-issued-on"
                type="date"
                value={issuedOn}
                disabled={pending}
                aria-invalid={Boolean(dateError)}
                onChange={(event) => setIssuedOn(event.target.value)}
              />
              {dateError ? <FieldError>{dateError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(valueError) || undefined}>
              <FieldLabel htmlFor="po-total-value">Purchase Order Value</FieldLabel>
              <MoneyInput
                id="po-total-value"
                value={totalValue}
                disabled={pending}
                aria-invalid={Boolean(valueError)}
                onValueChange={setTotalValue}
              />
              {valueError ? <FieldError>{valueError}</FieldError> : null}
            </Field>

            {operational ? (
              <Field data-invalid={Boolean(officeCategoryError) || undefined}>
                <FieldLabel htmlFor="po-office-category">
                  Office Expense Category
                </FieldLabel>
                <Select
                  items={officeItems}
                  value={officeExpenseCategoryId || null}
                  disabled={pending}
                  onValueChange={(value) => {
                    setOfficeExpenseCategoryId(value ?? "")
                    setAutoFilled((prev) => ({ ...prev, office: undefined }))
                  }}
                >
                  <SelectTrigger
                    id="po-office-category"
                    className="w-full"
                    aria-invalid={Boolean(officeCategoryError)}
                  >
                    <SelectValue placeholder="Select A Category" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {officeItems.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {officeCategoryError ? (
                  <FieldError>{officeCategoryError}</FieldError>
                ) : null}
                {officeExpenseCategoryId &&
                officeExpenseCategoryId === autoFilled.office ? (
                  <FieldDescription>Last used for this vendor.</FieldDescription>
                ) : null}
                {officeCountsAs ? (
                  <FieldDescription>{officeCountsAs}</FieldDescription>
                ) : null}
              </Field>
            ) : (
              <Field data-invalid={Boolean(categoryError) || undefined}>
                <FieldLabel htmlFor="po-expense-category">
                  Project Expense Category
                </FieldLabel>
                <Select
                  items={categoryItems}
                  value={expenseCategoryId || null}
                  disabled={pending}
                  onValueChange={(value) => {
                    setExpenseCategoryId(value ?? "")
                    setAutoFilled((prev) => ({ ...prev, expense: undefined }))
                  }}
                >
                  <SelectTrigger
                    id="po-expense-category"
                    className="w-full"
                    aria-invalid={Boolean(categoryError)}
                  >
                    <SelectValue placeholder="Select A Category" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {categoryItems.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {categoryError ? <FieldError>{categoryError}</FieldError> : null}
                {expenseCategoryId &&
                expenseCategoryId === autoFilled.expense ? (
                  <FieldDescription>Last used for this vendor.</FieldDescription>
                ) : null}
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="po-work-type">Vendor Work Type</FieldLabel>
              <Combobox
                autoComplete="off"
                items={workTypes}
                inputValue={workType}
                onInputValueChange={handleWorkTypeInput}
                onValueChange={(value) => {
                  if (typeof value === "string") {
                    setWorkType(value)
                    setAutoFilled((prev) => ({ ...prev, workType: undefined }))
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
            </Field>

            <Field>
              <FieldLabel htmlFor="po-notes">Notes</FieldLabel>
              <Textarea
                maxLength={1000}
                id="po-notes"
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
            {pending
              ? "Saving…"
              : purchaseOrderId
                ? "Save Changes"
                : "Save Purchase Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
