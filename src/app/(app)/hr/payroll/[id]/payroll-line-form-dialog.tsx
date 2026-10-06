"use client"

import { useState, useTransition } from "react"

import {
  addPayrollLine,
  updatePayrollLine,
  type PayrollLineFieldErrors,
} from "@/app/(app)/hr/payroll/actions"
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
import type { EmployeeOption, PayrollLineRow } from "@/lib/payroll"

export function PayrollLineFormDialog({
  open,
  onOpenChange,
  runId,
  line,
  employees,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  runId: string
  line: PayrollLineRow | null
  employees: readonly EmployeeOption[]
}) {
  const lineId = line?.id ?? null
  const [employeeId, setEmployeeId] = useState(line?.employeeId ?? "")
  const [basicSalary, setBasicSalary] = useState(
    line ? String(line.basicSalary) : "",
  )
  const [allowance, setAllowance] = useState(
    line ? String(line.allowance) : "0",
  )
  const [bonus, setBonus] = useState(line ? String(line.bonus) : "0")
  const [deductions, setDeductions] = useState(
    line ? String(line.deductions) : "0",
  )
  const [notes, setNotes] = useState(line?.notes ?? "")

  const [fieldErrors, setFieldErrors] = useState<PayrollLineFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const empItems = employees.map((e) => ({ value: e.id, label: e.name }))

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setFormError(null)
    setFieldErrors({})

    const input = {
      employeeId,
      basicSalary,
      allowance,
      bonus,
      deductions,
      notes: notes.trim(),
    }

    startSubmit(async () => {
      try {
        const result = lineId
          ? await updatePayrollLine(runId, lineId, input)
          : await addPayrollLine(runId, input)

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
        setFormError("Could not save this payroll line.")
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
            {lineId ? "Edit Payroll Line" : "Add Payroll Line"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pl-emp">Employee</Label>
            <Select
              items={empItems}
              value={employeeId || null}
              disabled={pending}
              onValueChange={(v) => setEmployeeId(v ?? "")}
            >
              <SelectTrigger
                id="pl-emp"
                className="w-full"
                aria-invalid={Boolean(fieldErrors.employeeId)}
              >
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent align="start">
                {empItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.employeeId ? (
              <p role="alert" className="text-sm text-destructive">
                {fieldErrors.employeeId}
              </p>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pl-basic">Basic Salary</Label>
              <Input
                id="pl-basic"
                type="number"
                step="0.01"
                value={basicSalary}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.basicSalary)}
                onChange={(e) => setBasicSalary(e.target.value)}
              />
              {fieldErrors.basicSalary ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.basicSalary}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pl-allowance">Allowance</Label>
              <Input
                id="pl-allowance"
                type="number"
                step="0.01"
                value={allowance}
                disabled={pending}
                onChange={(e) => setAllowance(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="pl-bonus">Bonus</Label>
              <Input
                id="pl-bonus"
                type="number"
                step="0.01"
                value={bonus}
                disabled={pending}
                onChange={(e) => setBonus(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pl-deductions">Deductions</Label>
              <Input
                id="pl-deductions"
                type="number"
                step="0.01"
                value={deductions}
                disabled={pending}
                onChange={(e) => setDeductions(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pl-notes">Notes</Label>
            <Textarea
              id="pl-notes"
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
            {pending ? "Saving…" : lineId ? "Save Changes" : "Add Line"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
