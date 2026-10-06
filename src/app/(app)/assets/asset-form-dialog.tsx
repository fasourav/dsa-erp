"use client"

import { useState, useTransition } from "react"

import {
  addAsset,
  updateAsset,
  type AssetFieldErrors,
} from "@/app/(app)/assets/actions"
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
import { Textarea } from "@/components/ui/textarea"
import type { AssetRow } from "@/lib/assets"

export function AssetFormDialog({
  open,
  onOpenChange,
  asset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  asset: AssetRow | null
}) {
  const assetId = asset?.id ?? null
  const [name, setName] = useState(asset?.name ?? "")
  const [category, setCategory] = useState(asset?.category ?? "")
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
      category: category.trim(),
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
        onOpenChange(false)
      } catch {
        setFormError("Could not save this asset.")
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
          <DialogTitle>{assetId ? "Edit Asset" : "Add New Asset"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="asset-name">Name</Label>
            <Input
              id="asset-name"
              value={name}
              disabled={pending}
              aria-invalid={Boolean(nameError)}
              onChange={(e) => setName(e.target.value)}
            />
            {nameError ? (
              <p role="alert" className="text-sm text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-category">Category</Label>
              <Input
                id="asset-category"
                value={category}
                disabled={pending}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-date">Purchase Date</Label>
              <Input
                id="asset-date"
                type="date"
                value={purchaseDate}
                disabled={pending}
                aria-invalid={Boolean(dateError)}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
              {dateError ? (
                <p role="alert" className="text-sm text-destructive">
                  {dateError}
                </p>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-qty">Quantity</Label>
              <Input
                id="asset-qty"
                type="number"
                min="1"
                value={quantity}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.quantity)}
                onChange={(e) => setQuantity(e.target.value)}
              />
              {fieldErrors.quantity ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.quantity}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-cost">Unit Cost</Label>
              <Input
                id="asset-cost"
                type="number"
                step="0.01"
                value={unitCost}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.unitCost)}
                onChange={(e) => setUnitCost(e.target.value)}
              />
              {fieldErrors.unitCost ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.unitCost}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-lifespan">Lifespan (Years)</Label>
              <Input
                id="asset-lifespan"
                type="number"
                min="1"
                value={lifespanYears}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.lifespanYears)}
                onChange={(e) => setLifespanYears(e.target.value)}
              />
              {fieldErrors.lifespanYears ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.lifespanYears}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="asset-notes">Notes</Label>
            <Textarea
              id="asset-notes"
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
            {pending ? "Saving…" : assetId ? "Save Changes" : "Save Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
