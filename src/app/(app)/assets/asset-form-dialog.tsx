"use client"

import { savedToast } from "@/lib/saved"
import { useState, useTransition } from "react"

import {
  addAsset,
  updateAsset,
  type AssetFieldErrors,
} from "@/app/(app)/assets/actions"
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
import type { AssetCategoryOption, AssetRow } from "@/lib/assets"

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: AssetRow | null
  categories: readonly AssetCategoryOption[]
}) {
  const assetId = asset?.id ?? null
  const [name, setName] = useState(asset?.name ?? "")
  const [categoryId, setCategoryId] = useState(asset?.categoryId ?? "")
  const [purchaseDate, setPurchaseDate] = useState(asset?.purchaseDate ?? "")
  const [quantity, setQuantity] = useState(
    asset ? String(asset.quantity) : "1",
  )
  const [unitCost, setUnitCost] = useState(
    asset ? String(asset.unitCost) : "",
  )
  const [lifespanYears, setLifespanYears] = useState(
    asset ? String(asset.lifespanYears) : "",
  )
  const [notes, setNotes] = useState(asset?.notes ?? "")

  const [attempted, setAttempted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<AssetFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const nameError =
    attempted && !name.trim() ? "Enter an asset name." : fieldErrors.name
  const dateError =
    attempted && !purchaseDate.trim()
      ? "Enter a purchase date."
      : fieldErrors.purchaseDate

  const categoryItems = [
    { value: "none", label: "None" },
    ...categories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ]

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setAttempted(true)
    setFormError(null)
    setFieldErrors({})

    if (!name.trim() || !purchaseDate.trim()) return

    const input = {
      name: name.trim(),
      categoryId: categoryId.trim(),
      purchaseDate: purchaseDate.trim(),
      quantity,
      unitCost,
      lifespanYears,
      notes: notes.trim(),
    }

    startSubmit(async () => {
      try {
        const result = assetId
          ? await updateAsset(assetId, input)
          : await addAsset(input)

        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
          return
        }
        if (result.error) {
          setFormError(result.error)
          return
        }
        savedToast()
        onOpenChange(false)
      } catch {
        setFormError("Could not save this asset.")
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
          <DialogTitle>{assetId ? "Edit Asset" : "Add New Asset"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {assetId ? <RecordAttachments parentType="asset" parentId={assetId} /> : null}
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(nameError) || undefined}>
              <FieldLabel htmlFor="asset-name">Name</FieldLabel>
              <Input
                id="asset-name"
                value={name}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(nameError)}
                onChange={(event) => setName(event.target.value)}
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.categoryId) || undefined}>
              <FieldLabel htmlFor="asset-category">Category</FieldLabel>
              <Select
                items={categoryItems}
                value={categoryId || "none"}
                onValueChange={(value) => {
                  setCategoryId(!value || value === "none" ? "" : value)
                }}
              >
                <SelectTrigger
                  id="asset-category"
                  className="w-full"
                  disabled={pending}
                  aria-invalid={Boolean(fieldErrors.categoryId)}
                >
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.categoryId ? <FieldError>{fieldErrors.categoryId}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(dateError) || undefined}>
              <FieldLabel htmlFor="asset-date">Purchase Date</FieldLabel>
              <Input
                id="asset-date"
                type="date"
                enterKeyHint="next"
                value={purchaseDate}
                disabled={pending}
                aria-invalid={Boolean(dateError)}
                onChange={(event) => setPurchaseDate(event.target.value)}
              />
              {dateError ? <FieldError>{dateError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.quantity) || undefined}>
              <FieldLabel htmlFor="asset-qty">Quantity</FieldLabel>
              <Input
                id="asset-qty"
                type="number"
                inputMode="numeric"
                min="1"
                enterKeyHint="next"
                autoComplete="off"
                value={quantity}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.quantity)}
                onChange={(event) => setQuantity(event.target.value)}
              />
              {fieldErrors.quantity ? <FieldError>{fieldErrors.quantity}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.unitCost) || undefined}>
              <FieldLabel htmlFor="asset-cost">Unit Cost</FieldLabel>
              <Input
                id="asset-cost"
                type="number"
                inputMode="decimal"
                step="0.01"
                enterKeyHint="next"
                autoComplete="off"
                value={unitCost}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.unitCost)}
                onChange={(event) => setUnitCost(event.target.value)}
              />
              {fieldErrors.unitCost ? <FieldError>{fieldErrors.unitCost}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.lifespanYears) || undefined}>
              <FieldLabel htmlFor="asset-lifespan">Lifespan (Years)</FieldLabel>
              <Input
                id="asset-lifespan"
                type="number"
                inputMode="numeric"
                min="1"
                enterKeyHint="next"
                autoComplete="off"
                value={lifespanYears}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.lifespanYears)}
                onChange={(event) => setLifespanYears(event.target.value)}
              />
              {fieldErrors.lifespanYears ? (
                <FieldError>{fieldErrors.lifespanYears}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="asset-notes">Notes</FieldLabel>
              <Textarea
                id="asset-notes"
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
            {pending ? "Saving…" : assetId ? "Save Changes" : "Save Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
