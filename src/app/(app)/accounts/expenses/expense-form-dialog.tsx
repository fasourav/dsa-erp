"use client"

import { useRecordVersion } from "@/lib/use-record-version"
import { savedToast } from "@/lib/saved"
import { useState, useTransition } from "react"

import {
  addOperationalExpense,
  updateOperationalExpense,
  type ExpenseFieldErrors,
} from "@/app/(app)/accounts/expenses/actions"
import { DuplicateWarning } from "@/app/(app)/accounts/duplicate-warning"
import { BankAccountField } from "@/components/bank-account-field"
import { RecordAttachments } from "@/components/record-attachments"
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
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import type { DuplicateMatch } from "@/lib/duplicate-outflow"
import { formatRecordedAt } from "@/lib/recorded-at"
import { isIsoDate, parseProjectValue, todayIsoDate } from "@/lib/project-validation"
import {
  countsAsLabel,
  type OfficeCategoryGroup,
} from "@/lib/report-cost-group"

const noneValue = "__none__"

export function ExpenseFormDialog({
  open,
  onOpenChange,
  expense,
  categories,
  departments,
  paymentMethods,
  bankAccounts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  expense: OperationalExpenseRow | null
  categories: readonly OfficeCategoryGroup[]
  departments: readonly NamedOption[]
  paymentMethods: readonly string[]
  bankAccounts: readonly BankAccountChoice[]
}) {
  const expenseId = expense?.id ?? null
  const version = useRecordVersion("operational_expenses", expenseId, open)
  const [expenseDate, setExpenseDate] = useState(
    expense?.expenseDate || todayIsoDate(),
  )
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "")
  const [category, setCategory] = useState(expense?.category ?? "")
  const [departmentId, setDepartmentId] = useState(expense?.departmentId ?? "")
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
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([])
  const [confirmNotDuplicate, setConfirmNotDuplicate] = useState(false)
  const [duplicateReason, setDuplicateReason] = useState("")
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
    (attempted && !categories.some((item) => item.name === category)
      ? "Choose a category."
      : null)
  const categoryItems = categories.map((item) => ({ value: item.name, label: item.name }))
  const selectedCategory = categories.find((item) => item.name === category)
  const departmentItems = [
    { value: noneValue, label: "None" },
    ...departments.map((department) => ({
      value: department.id,
      label: department.name || "—",
    })),
  ]
  function forgetDuplicate() {
    setConfirmNotDuplicate(false)
    setDuplicates([])
  }

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
      !categories.some((item) => item.name === category)
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
      notes: notes.trim(),
      bankAccountId,
      newAccountName: hasAccounts ? "" : accountName.trim(),
      newBankName: hasAccounts ? "" : bankName.trim(),
      confirmNotDuplicate,
      duplicateReason,
    }

    startSubmit(async () => {
      try {
        const result = expenseId
          ? await updateOperationalExpense(expenseId, { ...input, version })
          : await addOperationalExpense(input)

        setDuplicates(result.duplicates ?? [])
        if (result.fieldErrors) {
          setServerErrors(result.fieldErrors)
        }

        if (result.error) {
          setFormError(result.error)
        }
        if (result.fieldErrors || result.error || result.duplicates?.length) return

        savedToast()
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
        mobileLayout="nav"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>
            {expenseId ? "Edit Operational Expense" : "Add Operational Expense"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {expense ? (
            <p className="text-label text-muted-foreground">
              {expense.createdByName} · {formatRecordedAt(expense.createdAt)}
            </p>
          ) : null}
          {expenseId ? <RecordAttachments parentType="expense" parentId={expenseId} /> : null}
          <FieldGroup layout="inset">
            <Field span="half" data-invalid={Boolean(dateError) || undefined}>
              <FieldLabel htmlFor="expense-date">Date</FieldLabel>
              <Input
                id="expense-date"
                type="date"
                enterKeyHint="next"
                value={expenseDate}
                disabled={pending}
                aria-invalid={Boolean(dateError)}
                onChange={(event) => {
                  setExpenseDate(event.target.value)
                  forgetDuplicate()
                }}
              />
              {dateError ? <FieldError>{dateError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(amountError) || undefined}>
              <FieldLabel htmlFor="expense-amount">Amount</FieldLabel>
              <Input
                id="expense-amount"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="next"
                value={amount}
                disabled={pending}
                aria-invalid={Boolean(amountError)}
                onChange={(event) => {
                  setAmount(event.target.value)
                  forgetDuplicate()
                }}
              />
              {amountError ? <FieldError>{amountError}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(categoryError) || undefined}>
              <FieldLabel htmlFor="expense-category">Category</FieldLabel>
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
              {categoryError ? <FieldError>{categoryError}</FieldError> : null}
              {selectedCategory ? (
                <FieldDescription>
                  {countsAsLabel(selectedCategory.reportGroup)}
                </FieldDescription>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="expense-method">Payment Method</FieldLabel>
              <NameCombobox
                id="expense-method"
                value={paymentMethod}
                names={paymentMethods}
                disabled={pending}
                placeholder="Search Payment Methods"
                onValueChange={setPaymentMethod}
              />
            </Field>
            <div className="px-4 py-2.5 md:col-span-2 md:p-0">
              <BankAccountField
                idPrefix="expense"
                accounts={bankAccounts}
                accountId={bankAccountId}
                onAccountIdChange={(value) => {
                  setBankAccountId(value)
                  forgetDuplicate()
                }}
                accountName={accountName}
                onAccountNameChange={setAccountName}
                bankName={bankName}
                onBankNameChange={setBankName}
                disabled={pending}
                error={accountError}
              />
            </div>
            <Field data-invalid={Boolean(serverErrors.departmentId) || undefined}>
              <FieldLabel htmlFor="expense-department">Department</FieldLabel>
              <Select
                items={departmentItems}
                value={departmentId || noneValue}
                disabled={pending}
                onValueChange={(value) =>
                  setDepartmentId(!value || value === noneValue ? "" : value)
                }
              >
                <SelectTrigger
                  id="expense-department"
                  className="w-full"
                  aria-invalid={Boolean(serverErrors.departmentId)}
                >
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
                <FieldError>{serverErrors.departmentId}</FieldError>
              ) : null}
            </Field>
            <Field>
              <FieldDescription>
                Vendor costs go through Operational Purchase Orders, then a vendor bill and a vendor payment.
              </FieldDescription>
              {expense?.vendorName ? (
                <p className="text-label">Recorded Vendor: {expense.vendorName}</p>
              ) : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="expense-notes">Notes</FieldLabel>
              <Textarea
                maxLength={1000}
                id="expense-notes"
                value={notes}
                disabled={pending}
                placeholder="Add Notes"
                onChange={(event) => setNotes(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DuplicateWarning
            idPrefix="expense"
            matches={duplicates}
            confirmed={confirmNotDuplicate}
            onConfirmedChange={setConfirmNotDuplicate}
            reason={duplicateReason}
            onReasonChange={setDuplicateReason}
            reasonError={serverErrors.duplicateReason ?? null}
            disabled={pending}
          />
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
            {pending ? "Saving…" : expenseId ? "Save Changes" : "Save Expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
