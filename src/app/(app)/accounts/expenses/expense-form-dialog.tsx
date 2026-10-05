"use client"

import { useState, useTransition } from "react"

import {
  addOperationalExpense,
  updateOperationalExpense,
  type ExpenseFieldErrors,
} from "@/app/(app)/accounts/expenses/actions"
import { NameCombobox } from "@/components/name-combobox"
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
import type {
  NamedOption,
  OperationalExpenseRow,
} from "@/lib/operational-expenses"
import { isIsoDate, parseProjectValue, todayIsoDate } from "@/lib/project-validation"

const noneValue = "__none__"

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  categories,
  paymentMethods,
  projects,
  departments,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: OperationalExpenseRow | null
  categories: readonly string[]
  paymentMethods: readonly string[]
  projects: readonly NamedOption[]
  departments: readonly NamedOption[]
}) {
  const expenseId = expense?.id ?? null
  const [expenseDate, setExpenseDate] = useState(
    expense?.expenseDate || todayIsoDate(),
  )
  const [category, setCategory] = useState(expense?.category ?? "")
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "")
  const [paymentMethod, setPaymentMethod] = useState(expense?.paymentMethod ?? "")
  const [projectId, setProjectId] = useState(expense?.projectId ?? "")
  const [departmentId, setDepartmentId] = useState(expense?.departmentId ?? "")
  const [notes, setNotes] = useState(expense?.notes ?? "")
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<ExpenseFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const parsedAmount = parseProjectValue(amount)
  const dateError =
    serverErrors.expenseDate ??
    (attempted && !isIsoDate(expenseDate) ? "Enter a date." : null)
  const categoryError =
    serverErrors.category ??
    (attempted && !category.trim() ? "Enter a category." : null)
  const amountError =
    serverErrors.amount ??
    (attempted && parsedAmount === null
      ? amount.trim()
        ? "Enter an amount of 0 or more."
        : "Enter an amount."
      : null)
  const projectItems = [
    { value: noneValue, label: "None" },
    ...projects.map((project) => ({
      value: project.id,
      label: project.name || "—",
    })),
  ]
  const departmentItems = [
    { value: noneValue, label: "None" },
    ...departments.map((department) => ({
      value: department.id,
      label: department.name || "—",
    })),
  ]

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) {
      return
    }

    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setAttempted(true)
    setServerErrors({})
    setFormError(null)

    if (!isIsoDate(expenseDate) || !category.trim() || parsedAmount === null) {
      return
    }

    const input = {
      expenseDate,
      category: category.trim(),
      amount: amount.trim(),
      paymentMethod: paymentMethod.trim(),
      projectId,
      departmentId,
      notes: notes.trim(),
    }

    startSubmit(async () => {
      try {
        const result = expenseId
          ? await updateOperationalExpense(expenseId, input)
          : await addOperationalExpense(input)

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
        setFormError("Could not save this expense.")
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
            {expenseId ? "Edit operational expense" : "Add operational expense"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                value={expenseDate}
                disabled={pending}
                aria-invalid={Boolean(dateError)}
                onChange={(event) => setExpenseDate(event.target.value)}
              />
              {dateError ? (
                <p role="alert" className="text-sm text-destructive">
                  {dateError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-amount">Amount</Label>
              <Input
                id="expense-amount"
                inputMode="decimal"
                value={amount}
                disabled={pending}
                aria-invalid={Boolean(amountError)}
                onChange={(event) => setAmount(event.target.value)}
              />
              {amountError ? (
                <p role="alert" className="text-sm text-destructive">
                  {amountError}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-category">Category</Label>
            <NameCombobox
              id="expense-category"
              value={category}
              names={categories}
              disabled={pending}
              invalid={Boolean(categoryError)}
              placeholder="Search office expense categories"
              onValueChange={setCategory}
            />
            {categoryError ? (
              <p role="alert" className="text-sm text-destructive">
                {categoryError}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-method">Payment method</Label>
            <NameCombobox
              id="expense-method"
              value={paymentMethod}
              names={paymentMethods}
              disabled={pending}
              placeholder="Search payment methods"
              onValueChange={setPaymentMethod}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-project">Project</Label>
              <Select
                items={projectItems}
                value={projectId || noneValue}
                disabled={pending}
                onValueChange={(value) =>
                  setProjectId(!value || value === noneValue ? "" : value)
                }
              >
                <SelectTrigger id="expense-project" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent align="start">
                  {projectItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {serverErrors.projectId ? (
                <p role="alert" className="text-sm text-destructive">
                  {serverErrors.projectId}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-department">Department</Label>
              <Select
                items={departmentItems}
                value={departmentId || noneValue}
                disabled={pending}
                onValueChange={(value) =>
                  setDepartmentId(!value || value === noneValue ? "" : value)
                }
              >
                <SelectTrigger id="expense-department" className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent align="start">
                  {departmentItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {serverErrors.departmentId ? (
                <p role="alert" className="text-sm text-destructive">
                  {serverErrors.departmentId}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="expense-notes">Notes</Label>
            <Textarea
              id="expense-notes"
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
            {pending ? "Saving…" : expenseId ? "Save changes" : "Save expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
