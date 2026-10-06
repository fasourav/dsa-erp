"use client"

import { useState, useTransition } from "react"

import {
  addOperationalExpense,
  updateOperationalExpense,
  type ExpenseFieldErrors,
} from "@/app/(app)/accounts/expenses/actions"
import { BankAccountField } from "@/components/bank-account-field"
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
import {
  defaultBankAccountId,
  type BankAccountChoice,
} from "@/lib/bank-account"
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
  departments,
  vendors,
  paymentMethods,
  bankAccounts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: OperationalExpenseRow | null
  categories: readonly string[]
  departments: readonly NamedOption[]
  vendors: readonly NamedOption[]
  paymentMethods: readonly string[]
  bankAccounts: readonly BankAccountChoice[]
}) {
  const expenseId = expense?.id ?? null
  const [expenseDate, setExpenseDate] = useState(
    expense?.expenseDate || todayIsoDate(),
  )
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "")
  const [category, setCategory] = useState(expense?.category ?? "")
  const [departmentId, setDepartmentId] = useState(expense?.departmentId ?? "")
  const [vendorId, setVendorId] = useState(expense?.vendorId ?? "")
  const [notes, setNotes] = useState(expense?.notes ?? "")
  const [paymentMethod, setPaymentMethod] = useState(expense?.paymentMethod ?? "")
  const [bankAccountId, setBankAccountId] = useState(
    defaultBankAccountId(bankAccounts, expense?.bankAccountId ?? ""),
  )
  const [accountName, setAccountName] = useState("Operating account")
  const [bankName, setBankName] = useState("")
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<ExpenseFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const parsedAmount = parseProjectValue(amount)
  const dateError =
    serverErrors.expenseDate ??
    (attempted && !isIsoDate(expenseDate) ? "Enter a date." : null)
  const amountError =
    serverErrors.amount ??
    (attempted && (parsedAmount === null || parsedAmount <= 0)
      ? amount.trim()
        ? "Enter an amount greater than 0."
        : "Enter an amount."
      : null)
  const accountError = serverErrors.bankAccountId ?? null
  const hasAccounts =
    bankAccounts.some((account) => account.isActive) || Boolean(bankAccountId)
  const categoryError =
    serverErrors.category ??
    (attempted && !categories.includes(category) ? "Choose a category." : null)
  const categoryItems = categories.map((name) => ({ value: name, label: name }))
  const departmentItems = [
    { value: noneValue, label: "None" },
    ...departments.map((department) => ({
      value: department.id,
      label: department.name || "—",
    })),
  ]
  const vendorItems = [
    { value: noneValue, label: "None" },
    ...vendors.map((vendor) => ({
      value: vendor.id,
      label: vendor.name || "—",
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

    if (
      !isIsoDate(expenseDate) ||
      parsedAmount === null ||
      parsedAmount <= 0 ||
      !categories.includes(category)
    ) {
      return
    }

    if (hasAccounts && !bankAccountId) {
      setServerErrors({ bankAccountId: "Choose a bank account." })
      return
    }

    if (!hasAccounts && !accountName.trim()) {
      setServerErrors({ bankAccountId: "Enter an account name." })
      return
    }

    const input = {
      expenseDate,
      amount: amount.trim(),
      category,
      paymentMethod: paymentMethod.trim(),
      departmentId,
      vendorId,
      notes: notes.trim(),
      bankAccountId,
      newAccountName: hasAccounts ? "" : accountName.trim(),
      newBankName: hasAccounts ? "" : bankName.trim(),
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
            {expenseId ? "Edit Operational Expense" : "Add Operational Expense"}
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
            <Select
              items={categoryItems}
              value={category || null}
              disabled={pending}
              onValueChange={(value) => setCategory(value ?? "")}
            >
              <SelectTrigger
                id="expense-category"
                className="w-full"
                aria-invalid={Boolean(categoryError)}
              >
                <SelectValue placeholder="Select A Category" />
              </SelectTrigger>
              <SelectContent align="start">
                {categoryItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <BankAccountField
            idPrefix="expense"
            accounts={bankAccounts}
            accountId={bankAccountId}
            onAccountIdChange={setBankAccountId}
            accountName={accountName}
            onAccountNameChange={setAccountName}
            bankName={bankName}
            onBankNameChange={setBankName}
            disabled={pending}
            error={accountError}
          />
          <div className="grid gap-4 sm:grid-cols-2">
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
                  <SelectValue placeholder="Select A Department" />
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="expense-vendor">Vendor</Label>
              <Select
                items={vendorItems}
                value={vendorId || noneValue}
                disabled={pending}
                onValueChange={(value) =>
                  setVendorId(!value || value === noneValue ? "" : value)
                }
              >
                <SelectTrigger id="expense-vendor" className="w-full">
                  <SelectValue placeholder="Select A Vendor" />
                </SelectTrigger>
                <SelectContent align="start">
                  {vendorItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {serverErrors.vendorId ? (
                <p role="alert" className="text-sm text-destructive">
                  {serverErrors.vendorId}
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
              placeholder="Add Notes"
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
            {pending ? "Saving…" : expenseId ? "Save Changes" : "Save Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
