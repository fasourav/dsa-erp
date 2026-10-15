"use client"

import { savedToast } from "@/lib/saved"
import { useState, useTransition } from "react"

import {
  saveProjectBudgetLine,
  type BudgetLineFieldErrors,
} from "@/app/(app)/projects/[id]/budget-actions"
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
import type { BudgetCategory, BudgetLineView } from "@/lib/project-budget-model"

export function BudgetLineDialog({
  open,
  onOpenChange,
  projectId,
  line,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  line: BudgetLineView | null
  categories: readonly BudgetCategory[]
}) {
  const lineId = line?.lineId ?? null
  const [categoryId, setCategoryId] = useState(line?.categoryId ?? "")
  const [plannedAmount, setPlannedAmount] = useState(
    line ? String(line.planned) : "",
  )
  const [notes, setNotes] = useState(line?.notes ?? "")
  const [fieldErrors, setFieldErrors] = useState<BudgetLineFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const items = categories.map((category) => ({
    value: category.id,
    label: category.name,
  }))
  if (line?.categoryId && !items.some((item) => item.value === line.categoryId)) {
    items.push({
      value: line.categoryId,
      label: line.categoryName || "Category",
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setFormError(null)
    setFieldErrors({})
    const planned = Number(plannedAmount.trim().replace(/,/g, ""))
    if (plannedAmount.trim() && planned === 0) {
      setFieldErrors({ plannedAmount: "Enter a planned amount greater than 0." })
      setFormError("Check the highlighted fields.")
      return
    }
    const input = {
      projectId,
      categoryId,
      plannedAmount,
      notes,
    }
    startSubmit(async () => {
      try {
        const result = await saveProjectBudgetLine(lineId, input)
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        if (result.error) setFormError(result.error)
        if (result.fieldErrors || result.error) return
        savedToast()
        onOpenChange(false)
      } catch {
        setFormError("Could not save this budget line.")
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
          <DialogTitle>{lineId ? "Edit Budget Line" : "Add Budget Line"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(fieldErrors.categoryId) || undefined}>
              <FieldLabel htmlFor="budget-category">Category</FieldLabel>
              <Select
                items={items}
                value={categoryId || null}
                disabled={pending}
                onValueChange={(value) => setCategoryId(value ?? "")}
              >
                <SelectTrigger
                  id="budget-category"
                  className="w-full"
                  aria-invalid={Boolean(fieldErrors.categoryId)}
                >
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent align="start">
                  {items.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.categoryId ? (
                <FieldError>{fieldErrors.categoryId}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(fieldErrors.plannedAmount) || undefined}>
              <FieldLabel htmlFor="budget-planned">Planned Amount</FieldLabel>
              <Input
                id="budget-planned"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoCapitalize="off"
                enterKeyHint="next"
                value={plannedAmount}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.plannedAmount)}
                onChange={(event) => setPlannedAmount(event.target.value)}
              />
              {fieldErrors.plannedAmount ? (
                <FieldError>{fieldErrors.plannedAmount}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(fieldErrors.notes) || undefined}>
              <FieldLabel htmlFor="budget-notes">Notes</FieldLabel>
              <Textarea
                id="budget-notes"
                value={notes}
                disabled={pending}
                autoComplete="off"
                autoCapitalize="sentences"
                enterKeyHint="done"
                aria-invalid={Boolean(fieldErrors.notes)}
                onChange={(event) => setNotes(event.target.value)}
              />
              {fieldErrors.notes ? <FieldError>{fieldErrors.notes}</FieldError> : null}
            </Field>
          </FieldGroup>
          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <DialogClose
            render={<Button type="button" variant="outline" disabled={pending} />}
          >
            Cancel
          </DialogClose>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
