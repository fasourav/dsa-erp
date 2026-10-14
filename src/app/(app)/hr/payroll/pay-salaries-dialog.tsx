"use client"

import { savedToast } from "@/lib/saved"
import { useMemo, useState, useTransition } from "react"

import { useAccess } from "@/components/access-provider"

import {
  payMonthlySalary,
  updateMonthlySalary,
  type PaySalaryFieldErrors,
} from "@/app/(app)/hr/payroll/actions"
import { Money } from "@/components/money"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BankAccountChoice } from "@/lib/bank-account"
import { defaultBankAccountId } from "@/lib/bank-account"
import type { MonthlySalary, SalaryEmployee } from "@/lib/payroll"
import {
  currentMonthKey,
  netPay,
  parseMonthKey,
  roundMoney,
  workedInMonth,
} from "@/lib/payroll-month"
import { parseProjectValue, todayIsoDate } from "@/lib/project-validation"
import { cn } from "@/lib/utils"

type DraftRow = {
  employeeId: string
  name: string
  salary: number
  allowance: number
  bonus: string
  deduction: string
  included: boolean
}

type Adjustment = {
  bonus: string
  deduction: string
  included: boolean
}

export function PaySalariesDialog({
  open,
  onOpenChange,
  salary,
  employees,
  takenMonths,
  bankAccounts,
  paymentMethods,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  salary: MonthlySalary | null
  employees: readonly SalaryEmployee[]
  takenMonths: readonly string[]
  bankAccounts: readonly BankAccountChoice[]
  paymentMethods: readonly string[]
}) {
  const showFinancials = useAccess().showFinancials
  const salaryId = salary?.id ?? null
  const [month, setMonth] = useState(
    salary
      ? `${salary.periodYear}-${String(salary.periodMonth).padStart(2, "0")}`
      : currentMonthKey(),
  )
  const [adjustments, setAdjustments] = useState<Record<string, Adjustment>>({})
  const [paidOn, setPaidOn] = useState(salary?.paidOn || todayIsoDate())
  const [bankAccountId, setBankAccountId] = useState(
    defaultBankAccountId(bankAccounts, salary?.bankAccountId ?? ""),
  )
  const [paymentMethod, setPaymentMethod] = useState(salary?.paymentMethod ?? "")
  const [fieldErrors, setFieldErrors] = useState<PaySalaryFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const savedLines = useMemo(
    () => new Map((salary?.lines ?? []).map((line) => [line.employeeId, line])),
    [salary],
  )
  const parsedMonth = parseMonthKey(month)
  const monthTaken =
    !salaryId && parsedMonth !== null && takenMonths.includes(month)

  const rows = useMemo(() => {
    if (!parsedMonth) {
      return []
    }

    return employees
      .filter(
        (employee) =>
          workedInMonth(employee, parsedMonth.year, parsedMonth.month) ||
          savedLines.has(employee.id),
      )
      .map((employee) => {
        const saved = savedLines.get(employee.id)
        const adjustment = adjustments[employee.id]
        return {
          employeeId: employee.id,
          name: employee.fullName || "Employee",
          salary: saved ? saved.salary : employee.monthlySalary,
          allowance: saved ? saved.allowance : employee.allowance,
          bonus: adjustment?.bonus ?? (saved ? String(saved.bonus) : "0"),
          deduction:
            adjustment?.deduction ?? (saved ? String(saved.deduction) : "0"),
          included: adjustment?.included ?? (salaryId ? Boolean(saved) : true),
        }
      })
  }, [adjustments, employees, parsedMonth, salaryId, savedLines])

  const methodNames = useMemo(
    () => paymentMethods.filter(Boolean),
    [paymentMethods],
  )

  const included = rows.filter((row) => row.included)
  const total = roundMoney(
    included.reduce((sum, row) => sum + (rowNet(row) ?? 0), 0),
  )
  const monthError =
    fieldErrors.month ??
    (monthTaken ? "Salaries for this month are already paid." : undefined)

  function patchRow(row: DraftRow, patch: Partial<Adjustment>) {
    setAdjustments((current) => ({
      ...current,
      [row.employeeId]: {
        bonus: current[row.employeeId]?.bonus ?? row.bonus,
        deduction: current[row.employeeId]?.deduction ?? row.deduction,
        included: current[row.employeeId]?.included ?? row.included,
        ...patch,
      },
    }))
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setFormError(null)
    setFieldErrors({})

    if (!parsedMonth) {
      setFieldErrors({ month: "Choose a month." })
      return
    }

    if (monthTaken) {
      setFieldErrors({ month: "Salaries for this month are already paid." })
      return
    }

    if (included.length === 0) {
      setFormError("Include at least one employee.")
      return
    }

    for (const row of included) {
      const net = rowNet(row)
      if (net === null) {
        setFormError(`Enter a valid bonus and deduction for ${row.name}.`)
        return
      }
      if (net < 0) {
        setFormError(`Deduction is higher than pay for ${row.name}.`)
        return
      }
    }

    const input = {
      periodYear: String(parsedMonth.year),
      periodMonth: String(parsedMonth.month),
      paidOn: paidOn.trim(),
      bankAccountId,
      paymentMethod,
      lines: included.map((row) => ({
        employeeId: row.employeeId,
        bonus: row.bonus.trim() || "0",
        deduction: row.deduction.trim() || "0",
      })),
    }

    startSubmit(async () => {
      try {
        const result = salaryId
          ? await updateMonthlySalary(salaryId, input)
          : await payMonthlySalary(input)

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
        setFormError("Could not save this monthly salary.")
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
            {salaryId ? "Edit Monthly Salary" : "Pay Salaries"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(monthError) || undefined}>
              <FieldLabel htmlFor="pay-month">Month</FieldLabel>
              <Input
                id="pay-month"
                type="month"
                value={month}
                disabled={pending || Boolean(salaryId)}
                aria-invalid={Boolean(monthError)}
                onChange={(event) => {
                  setMonth(event.target.value)
                  setAdjustments({})
                  setFieldErrors((current) => ({ ...current, month: undefined }))
                }}
              />
              {monthError ? <FieldError>{monthError}</FieldError> : null}
            </Field>
          </FieldGroup>

          <div className="min-w-0 overflow-x-auto">
            <Table className="min-w-max">
              <TableHeader>
                <TableRow className="bg-muted hover:bg-muted">
                  <TableHead>Include</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead className="text-right">Allowance</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead className="text-right">Deduction</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center whitespace-normal text-muted-foreground"
                    >
                      No Active Employees For This Month.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const net = rowNet(row)
                    return (
                      <TableRow
                        key={row.employeeId}
                        className={cn(!row.included && "text-muted-foreground")}
                      >
                        <TableCell>
                          <Checkbox
                            checked={row.included}
                            disabled={pending}
                            aria-label={`Include ${row.name}`}
                            onCheckedChange={(checked) =>
                              patchRow(row, { included: Boolean(checked) })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-ui font-semibold">{row.name}</TableCell>
                        <TableCell className="text-right">
                          <PayAmount show={showFinancials} value={row.salary} />
                        </TableCell>
                        <TableCell className="text-right">
                          <PayAmount show={showFinancials} value={row.allowance} />
                        </TableCell>
                        <TableCell className="text-right">
                          {showFinancials ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            enterKeyHint="next"
                            className="ml-auto w-28 text-right"
                            aria-label={`Bonus for ${row.name}`}
                            value={row.bonus}
                            disabled={pending || !row.included}
                            onChange={(event) =>
                              patchRow(row, { bonus: event.target.value })
                            }
                          />
                          ) : (
                            <span className="text-muted-foreground">Hidden</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {showFinancials ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            enterKeyHint="next"
                            className="ml-auto w-28 text-right"
                            aria-label={`Deduction for ${row.name}`}
                            value={row.deduction}
                            disabled={pending || !row.included}
                            onChange={(event) =>
                              patchRow(row, { deduction: event.target.value })
                            }
                          />
                          ) : (
                            <span className="text-muted-foreground">Hidden</span>
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            net !== null && net < 0 && "text-destructive",
                          )}
                        >
                          {net === null ? "—" : <PayAmount show={showFinancials} value={net} />}
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <FieldGroup layout="inset">
            <Field span="half" data-invalid={Boolean(fieldErrors.paidOn) || undefined}>
              <FieldLabel htmlFor="pay-date">Payment Date</FieldLabel>
              <Input
                id="pay-date"
                type="date"
                value={paidOn}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.paidOn)}
                onChange={(event) => setPaidOn(event.target.value)}
              />
              {fieldErrors.paidOn ? <FieldError>{fieldErrors.paidOn}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.bankAccountId) || undefined}>
              <FieldLabel htmlFor="pay-account">Bank Account</FieldLabel>
              {bankAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add a bank account in Settings before paying salaries.
                </p>
              ) : (
                <Select
                  items={bankAccounts.map((account) => ({
                    value: account.id,
                    label: account.name || "Account",
                  }))}
                  value={bankAccountId}
                  disabled={pending}
                  onValueChange={(value) => setBankAccountId(value ?? "")}
                >
                  <SelectTrigger
                    id="pay-account"
                    className="w-full"
                    aria-invalid={Boolean(fieldErrors.bankAccountId)}
                  >
                    <SelectValue placeholder="Choose An Account" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name || "Account"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {fieldErrors.bankAccountId ? (
                <FieldError>{fieldErrors.bankAccountId}</FieldError>
              ) : null}
            </Field>
            <Field data-invalid={Boolean(fieldErrors.paymentMethod) || undefined}>
              <FieldLabel htmlFor="pay-method">Payment Method</FieldLabel>
              {methodNames.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Add a payment method in Settings before paying salaries.
                </p>
              ) : (
                <Select
                  items={methodNames.map((name) => ({ value: name, label: name }))}
                  value={paymentMethod || null}
                  disabled={pending}
                  onValueChange={(value) => setPaymentMethod(value ?? "")}
                >
                  <SelectTrigger
                    id="pay-method"
                    className="w-full"
                    aria-invalid={Boolean(fieldErrors.paymentMethod)}
                  >
                    <SelectValue placeholder="Choose A Payment Method" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {methodNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {fieldErrors.paymentMethod ? (
                <FieldError>{fieldErrors.paymentMethod}</FieldError>
              ) : null}
            </Field>
          </FieldGroup>

          <p className="flex items-baseline gap-2 px-1 text-callout font-semibold md:px-0" aria-live="polite">
            <span>Total</span>
            <PayAmount show={showFinancials} value={total} />
          </p>

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
          <Button
            type="button"
            disabled={
              pending ||
              monthTaken ||
              rows.length === 0 ||
              bankAccounts.length === 0 ||
              methodNames.length === 0
            }
            onClick={handleSubmit}
          >
            {pending
              ? salaryId
                ? "Saving…"
                : "Paying…"
              : salaryId
                ? "Save Changes"
                : "Pay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PayAmount({ show, value }: { show: boolean; value: number }) {
  if (!show) {
    return <span className="text-muted-foreground">Hidden</span>
  }

  return <Money value={value} />
}

function rowNet(row: DraftRow): number | null {
  const bonus = parseProjectValue(row.bonus.trim() || "0")
  const deduction = parseProjectValue(row.deduction.trim() || "0")
  if (bonus === null || deduction === null) {
    return null
  }

  return netPay(row.salary, row.allowance, bonus, deduction)
}
