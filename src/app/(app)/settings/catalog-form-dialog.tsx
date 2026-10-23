"use client"

import { savedToast } from "@/lib/saved"
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
import { Field, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  catalogSingularTitle,
  nextSortOrder,
  parseSortOrder,
  slugifyCatalogCode,
  type CatalogItem,
  type CatalogList,
} from "@/lib/lookup-catalogs"
import {
  isReportGroup,
  reportGroupOptions,
  type ReportGroup,
} from "@/lib/report-cost-group"

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
  const [reportGroup, setReportGroup] = useState<ReportGroup | "">(
    item?.reportGroup ?? "",
  )
  const [nameError, setNameError] = useState<string | null>(null)
  const [sortOrderError, setSortOrderError] = useState<string | null>(null)
  const [reportGroupError, setReportGroupError] = useState<string | null>(null)
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
    setReportGroupError(fieldErrors.reportGroup ?? null)
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
    const nextReportGroupError =
      catalog.hasReportGroup && !isReportGroup(reportGroup)
        ? "Choose a report group."
        : null
    const resolvedCode = catalog.hasCode
      ? slugifyCatalogCode(trimmedName)
      : ""

    setNameError(nextNameError)
    setSortOrderError(nextSortOrderError)
    setReportGroupError(nextReportGroupError)
    setFormError(null)

    if (!trimmedName || parsedSortOrder === null || nextReportGroupError) {
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
      reportGroup: catalog.hasReportGroup ? reportGroup : undefined,
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

        savedToast()
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
        mobileLayout="nav"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Names in {catalog.label} must be unique.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(nameError) || undefined}>
              <FieldLabel htmlFor="catalog-name">Name</FieldLabel>
              <Input
                id="catalog-name"
                value={name}
                autoFocus
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(nameError)}
                onChange={(event) => {
                  setName(event.target.value)
                  setNameError(null)
                }}
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>

            {catalog.hasReportGroup ? (
              <Field data-invalid={Boolean(reportGroupError) || undefined}>
                <FieldLabel htmlFor="catalog-report-group">Report Group</FieldLabel>
                <Select
                  items={reportGroupOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  }))}
                  value={reportGroup || null}
                  disabled={pending}
                  onValueChange={(value) => {
                    setReportGroup(isReportGroup(value) ? value : "")
                    setReportGroupError(null)
                  }}
                >
                  <SelectTrigger
                    id="catalog-report-group"
                    className="w-full"
                    aria-invalid={Boolean(reportGroupError)}
                  >
                    <SelectValue placeholder="Select A Report Group" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {reportGroupOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {reportGroupError ? <FieldError>{reportGroupError}</FieldError> : null}
              </Field>
            ) : null}

            <Field data-invalid={Boolean(sortOrderError) || undefined}>
              <FieldLabel htmlFor="catalog-sort-order">Sort Order</FieldLabel>
              <Input
                id="catalog-sort-order"
                inputMode="numeric"
                enterKeyHint={catalog.hasActive ? "next" : "done"}
                value={sortOrder}
                disabled={pending}
                aria-invalid={Boolean(sortOrderError)}
                onChange={(event) => {
                  setSortOrder(event.target.value)
                  setSortOrderError(null)
                }}
              />
              {sortOrderError ? <FieldError>{sortOrderError}</FieldError> : null}
            </Field>

            {catalog.hasActive ? (
              <Field>
                <FieldTitle id="catalog-active-label">Status</FieldTitle>
                <label className="flex min-h-11 items-center gap-2.5 text-base md:min-h-0 md:text-sm">
                  <Checkbox
                    checked={isActive}
                    disabled={pending}
                    onCheckedChange={(checked) => setIsActive(checked === true)}
                  />
                  Active
                </label>
              </Field>
            ) : null}
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
            {pending ? "Saving…" : item ? "Save Changes" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}