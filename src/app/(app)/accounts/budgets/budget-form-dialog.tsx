"use client"

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
import type { BudgetRow, DepartmentOption } from "@/lib/budgets"

const monthItems = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
].map((name, i) => ({ value: String(i + 1), label: name }))

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

  const deptItems = departments.map((d) => ({ value: d.id, label: d.name }))

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
          return
        }
        if (result.error) {
          setFormError(result.error)
          return
        }
        onOpenChange(false)
      } catch {
        setFormError("Could not save this budget.")
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
          <DialogTitle>
            {budgetId ? "Edit Budget" : "Add New Budget"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bgt-dept">Department</Label>
            <Select
              items={deptItems}
              value={departmentId || null}
              disabled={pending}
              onValueChange={(v) => setDepartmentId(v ?? "")}
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
              <p role="alert" className="text-sm text-destructive">
                {fieldErrors.departmentId}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bgt-year">Year</Label>
              <Input
                id="bgt-year"
                type="number"
                value={periodYear}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.periodYear)}
                onChange={(e) => setPeriodYear(e.target.value)}
              />
              {fieldErrors.periodYear ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.periodYear}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bgt-month">Month</Label>
              <Select
                items={monthItems}
                value={periodMonth}
                disabled={pending}
                onValueChange={(v) => setPeriodMonth(v ?? "")}
              >
                <SelectTrigger id="bgt-month" className="w-full">
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
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.periodMonth}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bgt-amount">Allocated Budget</Label>
            <Input
              id="bgt-amount"
              type="number"
              step="0.01"
              value={allocatedBudget}
              disabled={pending}
              aria-invalid={Boolean(fieldErrors.allocatedBudget)}
              onChange={(e) => setAllocatedBudget(e.target.value)}
            />
            {fieldErrors.allocatedBudget ? (
              <p role="alert" className="text-sm text-destructive">
                {fieldErrors.allocatedBudget}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bgt-notes">Notes</Label>
            <Textarea
              id="bgt-notes"
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
