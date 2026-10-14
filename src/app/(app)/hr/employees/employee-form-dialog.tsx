"use client"

import { savedToast } from "@/lib/saved"
import { useState, useTransition } from "react"

import {
  addEmployee,
  updateEmployee,
  type EmployeeFieldErrors,
} from "@/app/(app)/hr/employees/actions"
import { useAccess } from "@/components/access-provider"
import { RecordAttachments } from "@/components/record-attachments"
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
import { PhoneInput } from "@/components/phone-input"
import { Field, FieldError, FieldGroup, FieldLabel, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { DepartmentOption, EmployeeRow } from "@/lib/employees"
import { phoneErrorForStored } from "@/lib/phone"

export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  departments,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee: EmployeeRow | null
  departments: readonly DepartmentOption[]
}) {
  const showFinancials = useAccess().showFinancials
  const hidePay = Boolean(employee) && !showFinancials
  const employeeId = employee?.id ?? null
  const [fullName, setFullName] = useState(employee?.fullName ?? "")
  const [departmentId, setDepartmentId] = useState(
    employee?.departmentId ?? "",
  )
  const [designation, setDesignation] = useState(employee?.designation ?? "")
  const [monthlySalary, setMonthlySalary] = useState(
    employee ? String(employee.monthlySalary) : "",
  )
  const [allowance, setAllowance] = useState(
    employee ? String(employee.allowance) : "",
  )
  const [joiningDate, setJoiningDate] = useState(employee?.joiningDate ?? "")
  const [leaveDate, setLeaveDate] = useState(employee?.leaveDate ?? "")
  const [isActive, setIsActive] = useState(employee?.isActive ?? true)
  const [phone, setPhone] = useState(employee?.phone ?? "")
  const [email, setEmail] = useState(employee?.email ?? "")
  const [notes, setNotes] = useState(employee?.notes ?? "")

  const [attempted, setAttempted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<EmployeeFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const nameError =
    attempted && !fullName.trim() ? "Enter the employee name." : fieldErrors.fullName
  const salaryError =
    attempted && !monthlySalary.trim()
      ? "Enter a monthly salary."
      : fieldErrors.monthlySalary
  const joiningError =
    attempted && !joiningDate.trim()
      ? "Enter a joining date."
      : fieldErrors.joiningDate
  const phoneError = phoneErrorForStored(phone) ?? fieldErrors.phone

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setAttempted(true)
    setFormError(null)
    setFieldErrors({})

    if (!fullName.trim() || !joiningDate.trim() || !monthlySalary.trim() || phoneErrorForStored(phone)) {
      return
    }

    const input = {
      fullName: fullName.trim(),
      departmentId,
      designation: designation.trim(),
      monthlySalary: monthlySalary.trim(),
      allowance: allowance.trim(),
      joiningDate: joiningDate.trim(),
      leaveDate: leaveDate.trim(),
      isActive,
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim(),
    }

    startSubmit(async () => {
      try {
        const result = employeeId
          ? await updateEmployee(employeeId, input)
          : await addEmployee(input)

        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors)
          return
        }

        if (result.error) {
          setFormError(result.error)
          return
        }

        savedToast()
        onOpenChange(false)
      } catch {
        setFormError("Could not save this employee.")
      }
    })
  }

  const deptItems = departments.map((d) => ({ value: d.id, label: d.name }))
  if (
    employee?.departmentId &&
    !deptItems.some((item) => item.value === employee.departmentId)
  ) {
    deptItems.push({
      value: employee.departmentId,
      label: employee.department.trim() || "Department",
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
            {employeeId ? "Edit Employee" : "Add New Employee"}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {employeeId ? <RecordAttachments parentType="employee" parentId={employeeId} /> : null}
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(nameError) || undefined}>
              <FieldLabel htmlFor="emp-name">Full Name</FieldLabel>
              <Input
                id="emp-name"
                maxLength={120}
                value={fullName}
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(nameError)}
                onChange={(e) => setFullName(e.target.value)}
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>

            <Field span="half" data-invalid={Boolean(fieldErrors.departmentId) || undefined}>
              <FieldLabel htmlFor="emp-dept">Department</FieldLabel>
              <Select
                items={deptItems}
                value={departmentId || null}
                disabled={pending}
                onValueChange={(v) => setDepartmentId(v ?? "")}
              >
                <SelectTrigger id="emp-dept" className="w-full">
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
            <Field span="half">
              <FieldLabel htmlFor="emp-designation">Designation</FieldLabel>
              <Input
                id="emp-designation"
                value={designation}
                autoComplete="organization-title"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                onChange={(e) => setDesignation(e.target.value)}
              />
            </Field>

            <Field span="half" data-invalid={Boolean(salaryError) || undefined}>
              <FieldLabel htmlFor="emp-salary">Monthly Salary</FieldLabel>
              {hidePay ? (
                <p id="emp-salary" className="flex min-h-11 items-center text-base text-muted-foreground md:min-h-10.5 md:text-sm">
                  Hidden
                </p>
              ) : (
                <Input
                  id="emp-salary"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  enterKeyHint="next"
                  value={monthlySalary}
                  disabled={pending}
                  aria-invalid={Boolean(salaryError)}
                  onChange={(e) => setMonthlySalary(e.target.value)}
                />
              )}
              {salaryError ? <FieldError>{salaryError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.allowance) || undefined}>
              <FieldLabel htmlFor="emp-allowance">Allowance</FieldLabel>
              {hidePay ? (
                <p id="emp-allowance" className="flex min-h-11 items-center text-base text-muted-foreground md:min-h-10.5 md:text-sm">
                  Hidden
                </p>
              ) : (
                <Input
                  id="emp-allowance"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  enterKeyHint="next"
                  value={allowance}
                  disabled={pending}
                  placeholder="0"
                  aria-invalid={Boolean(fieldErrors.allowance)}
                  onChange={(e) => setAllowance(e.target.value)}
                />
              )}
              {fieldErrors.allowance ? (
                <FieldError>{fieldErrors.allowance}</FieldError>
              ) : null}
            </Field>

            <Field span="half" data-invalid={Boolean(joiningError) || undefined}>
              <FieldLabel htmlFor="emp-joining">Joining Date</FieldLabel>
              <Input
                id="emp-joining"
                type="date"
                value={joiningDate}
                disabled={pending}
                aria-invalid={Boolean(joiningError)}
                onChange={(e) => setJoiningDate(e.target.value)}
              />
              {joiningError ? <FieldError>{joiningError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.leaveDate) || undefined}>
              <FieldLabel htmlFor="emp-leave">Leave Date</FieldLabel>
              <Input
                id="emp-leave"
                type="date"
                value={leaveDate}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.leaveDate)}
                onChange={(e) => setLeaveDate(e.target.value)}
              />
              {fieldErrors.leaveDate ? (
                <FieldError>{fieldErrors.leaveDate}</FieldError>
              ) : null}
            </Field>

            <Field span="half">
              <FieldLabel htmlFor="emp-email">Email</FieldLabel>
              <Input
                id="emp-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                value={email}
                disabled={pending}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field span="half" data-invalid={Boolean(phoneError) || undefined}>
              <FieldLabel htmlFor="emp-phone">Phone</FieldLabel>
              <PhoneInput
                id="emp-phone"
                defaultValue={employee?.phone ?? ""}
                disabled={pending}
                invalid={Boolean(phoneError)}
                onChange={setPhone}
              />
              {phoneError ? <FieldError>{phoneError}</FieldError> : null}
            </Field>

            <Field>
              <FieldTitle id="emp-active-label">Status</FieldTitle>
              <label className="flex min-h-11 items-center gap-2.5 text-base md:min-h-0 md:text-sm">
                <Checkbox
                  checked={isActive}
                  disabled={pending}
                  onCheckedChange={(checked) => setIsActive(Boolean(checked))}
                />
                Active Employee
              </label>
            </Field>

            <Field>
              <FieldLabel htmlFor="emp-notes">Notes</FieldLabel>
              <Textarea
                maxLength={1000}
                id="emp-notes"
                value={notes}
                enterKeyHint="done"
                disabled={pending}
                onChange={(e) => setNotes(e.target.value)}
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
              : employeeId
                ? "Save Changes"
                : "Save Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
