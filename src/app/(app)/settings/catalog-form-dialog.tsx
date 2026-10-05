"use client"

import { useState, useTransition } from "react"

import {
  addCatalogItem,
  updateCatalogItem,
  type CatalogFieldErrors,
} from "@/app/(app)/settings/actions"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  nextSortOrder,
  parseSortOrder,
  type CatalogItem,
  type CatalogList,
} from "@/lib/lookup-catalogs"

export function CatalogFormDialog({
  open,
  onOpenChange,
  catalog,
  item,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog: CatalogList
  item: CatalogItem | null
}) {
  const [name, setName] = useState(item?.name ?? "")
  const [sortOrder, setSortOrder] = useState(
    String(item?.sortOrder ?? nextSortOrder(catalog.items)),
  )
  const [isActive, setIsActive] = useState(item?.isActive ?? true)
  const [nameError, setNameError] = useState<string | null>(null)
  const [sortOrderError, setSortOrderError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) {
      return
    }

    onOpenChange(nextOpen)
  }

  function applyFieldErrors(fieldErrors: CatalogFieldErrors) {
    setNameError(fieldErrors.name ?? null)
    setSortOrderError(fieldErrors.sortOrder ?? null)
    if (fieldErrors.isActive) {
      setFormError(fieldErrors.isActive)
    }
  }

  function handleSubmit() {
    const trimmedName = name.trim()
    const parsedSortOrder = parseSortOrder(sortOrder)
    const nextNameError = trimmedName ? null : "Enter a name."
    const nextSortOrderError =
      parsedSortOrder === null ? "Enter a whole number." : null

    setNameError(nextNameError)
    setSortOrderError(nextSortOrderError)
    setFormError(null)

    if (!trimmedName || parsedSortOrder === null) {
      return
    }

    const input = {
      catalog: catalog.key,
      name: trimmedName,
      sortOrder: parsedSortOrder,
      isActive,
    }

    startSubmit(async () => {
      try {
        const result = item
          ? await updateCatalogItem(item.id, input)
          : await addCatalogItem(input)

        if (result.fieldErrors) {
          applyFieldErrors(result.fieldErrors)
          return
        }

        if (result.error) {
          setFormError(result.error)
          return
        }

        onOpenChange(false)
      } catch {
        setFormError("Could not save this item.")
      }
    })
  }

  const title = item ? `Edit ${catalog.singular}` : `Add ${catalog.singular}`

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Names in {catalog.label} must be unique.
          </DialogDescription>
        </DialogHeader>

        <form
          id="catalog-item-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            handleSubmit()
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="catalog-name">Name</Label>
            <Input
              id="catalog-name"
              value={name}
              autoFocus
              disabled={pending}
              aria-invalid={Boolean(nameError)}
              onChange={(event) => {
                setName(event.target.value)
                setNameError(null)
              }}
            />
            {nameError ? (
              <p role="alert" className="text-sm text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="catalog-sort-order">Sort order</Label>
            <Input
              id="catalog-sort-order"
              inputMode="numeric"
              value={sortOrder}
              disabled={pending}
              aria-invalid={Boolean(sortOrderError)}
              onChange={(event) => {
                setSortOrder(event.target.value)
                setSortOrderError(null)
              }}
            />
            {sortOrderError ? (
              <p role="alert" className="text-sm text-destructive">
                {sortOrderError}
              </p>
            ) : null}
          </div>

          {catalog.hasActive ? (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isActive}
                disabled={pending}
                onCheckedChange={(checked) => setIsActive(checked)}
              />
              Active
            </label>
          ) : null}

          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
        </form>

        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline" disabled={pending} />
            }
          >
            Cancel
          </DialogClose>
          <Button type="submit" form="catalog-item-form" disabled={pending}>
            {pending ? "Saving…" : item ? "Save changes" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
