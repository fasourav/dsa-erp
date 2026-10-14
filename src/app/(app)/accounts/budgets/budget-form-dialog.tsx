"use client"

import { savedToast } from "@/lib/saved"
import { useState, useTransition } from "react"

import {
  addBudget,
  updateBudget,
  type BudgetFieldErrors,
} from "@/app/(app)/accounts/budgets/actions"
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
import type { BudgetRow, DepartmentOption } from "@/lib/budgets"

const monthItems = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
].map((name, index) => ({ value: String(index + 1), label: name }))

export function BudgetFormDialog({
  open,
  onOpenChange,
  budget,
  departments,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  budget: BudgetRow | null
  departments: readonly DepartmentOption[]
}) {
  const budgetId = budget?.id ?? null
  const now = new Date()
  const [departmentId, setDepartmentId] = useState(budget?.departmentId ?? "")
  const [periodYear, setPeriodYear] = useState(
    String(budget?.periodYear ?? now.getFullYear()),
  )
  const [periodMonth, setPeriodMonth] = useState(
    String(budget?.periodMonth ?? now.getMonth() + 1),
  )
  const [allocatedBudget, setAllocatedBudget] = useState(
    budget ? String(budget.allocatedBudget) : "",
  )
  const [notes, setNotes] = useState(budget?.notes ?? "")

  const [fieldErrors, setFieldErrors] = useState<BudgetFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const deptItems = departments.map((department) => ({
    value: department.id,
    label: department.name,
  }))
  if (
    budget?.departmentId &&
    !deptItems.some((item) => item.value === budget.departmentId)
  ) {
    deptItems.push({
      value: budget.departmentId,
      label: budget.department.trim() || "Department",
    })
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setFormError(null)
    setFieldErrors({})

    const input = {
      departmentId,
      periodYear,
      periodMonth,
      allocatedBudget,
      notes: notes.trim(),
    }

    startSubmit(async () => {
      try {
        const result = budgetId
          ? await updateBudget(budgetId, input)
          : await addBudget(input)

        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
        }
        if (result.error) {
          setFormError(result.error)
        }
        if (result.fieldErrors || result.error) return
        savedToast()
        onOpenChange(false)
      } catch {
        setFormError("Could not save this budget.")
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
            {budgetId ? "Edit Budget" : "Add New Budget"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(fieldErrors.departmentId) || undefined}>
              <FieldLabel htmlFor="bgt-dept">Department</FieldLabel>
              <Select
                items={deptItems}
                value={departmentId || null}
                disabled={pending}
                onValueChange={(value) => setDepartmentId(value ?? "")}
              >
                <SelectTrigger
                  id="bgt-dept"
                  className="w-full"
                  aria-invalid={Boolean(fieldErrors.departmentId)}
                >
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent align="start">
                  {deptItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.departmentId ? (
                <FieldError>{fieldErrors.departmentId}</FieldError>
              ) : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.periodYear) || undefined}>
              <FieldLabel htmlFor="bgt-year">Year</FieldLabel>
              <Input
                id="bgt-year"
                type="number"
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="next"
                value={periodYear}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.periodYear)}
                onChange={(event) => setPeriodYear(event.target.value)}
              />
              {fieldErrors.periodYear ? <FieldError>{fieldErrors.periodYear}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.periodMonth) || undefined}>
              <FieldLabel htmlFor="bgt-month">Month</FieldLabel>
              <Select
                items={monthItems}
                value={periodMonth}
                disabled={pending}
                onValueChange={(value) => setPeriodMonth(value ?? "")}
              >
                <SelectTrigger
                  id="bgt-month"
                  className="w-full"
                  aria-invalid={Boolean(fieldErrors.periodMonth)}
                >
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent align="start">
                  {monthItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.periodMonth ? (
                <FieldError>{fieldErrors.periodMonth}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(fieldErrors.allocatedBudget) || undefined}>
              <FieldLabel htmlFor="bgt-amount">Allocated Budget</FieldLabel>
              <Input
                id="bgt-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                autoComplete="off"
                enterKeyHint="next"
                value={allocatedBudget}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.allocatedBudget)}
                onChange={(event) => setAllocatedBudget(event.target.value)}
              />
              {fieldErrors.allocatedBudget ? (
                <FieldError>{fieldErrors.allocatedBudget}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="bgt-notes">Notes</FieldLabel>
              <Textarea
                maxLength={1000}
                id="bgt-notes"
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
              : budgetId
                ? "Save Changes"
                : "Save Budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
