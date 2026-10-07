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
  DialogBody,
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
  catalogSingularTitle,
  nextSortOrder,
  parseSortOrder,
  slugifyCatalogCode,
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
  const isCreate = !item

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) {
      return
    }

    onOpenChange(nextOpen)
  }

  function applyFieldErrors(fieldErrors: CatalogFieldErrors) {
    setNameError(fieldErrors.name ?? fieldErrors.code ?? null)
    setSortOrderError(fieldErrors.sortOrder ?? null)
    if (fieldErrors.isActive || fieldErrors.isOpen) {
      setFormError(fieldErrors.isActive ?? fieldErrors.isOpen ?? null)
    }
  }

  function handleSubmit() {
    const trimmedName = name.trim()
    const parsedSortOrder = parseSortOrder(sortOrder)
    const nextNameError = trimmedName ? null : "Enter a name."
    const nextSortOrderError =
      parsedSortOrder === null ? "Enter a whole number." : null
    const resolvedCode = catalog.hasCode
      ? slugifyCatalogCode(trimmedName)
      : ""

    setNameError(nextNameError)
    setSortOrderError(nextSortOrderError)
    setFormError(null)

    if (!trimmedName || parsedSortOrder === null) {
      return
    }

    if (catalog.hasCode && isCreate && !/^[a-z][a-z0-9_]*$/.test(resolvedCode)) {
      setNameError("Enter a name that can be saved as a status.")
      return
    }

    const input = {
      catalog: catalog.key,
      name: trimmedName,
      sortOrder: parsedSortOrder,
      isActive,
      code: catalog.hasCode
        ? isCreate
          ? resolvedCode
          : (item?.code ?? resolvedCode)
        : undefined,
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

  const itemTitle = catalogSingularTitle(catalog.singular)
  const title = item ? `Edit ${itemTitle}` : `Add ${itemTitle}`

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="overflow-hidden sm:max-w-lg"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Names in {catalog.label} must be unique.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
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
            <Label htmlFor="catalog-sort-order">Sort Order</Label>
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
            {pending ? "Saving…" : item ? "Save Changes" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}