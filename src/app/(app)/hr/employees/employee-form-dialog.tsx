"use client"

import { useState, useTransition } from "react"

import {
  addEmployee,
  updateEmployee,
  type EmployeeFieldErrors,
} from "@/app/(app)/hr/employees/actions"
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
import type { DepartmentOption, EmployeeRow } from "@/lib/employees"

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
  const employeeId = employee?.id ?? null
  const [fullName, setFullName] = useState(employee?.fullName ?? "")
  const [departmentId, setDepartmentId] = useState(
    employee?.departmentId ?? "",
  )
  const [designation, setDesignation] = useState(employee?.designation ?? "")
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
  const joiningError =
    attempted && !joiningDate.trim()
      ? "Enter a joining date."
      : fieldErrors.joiningDate

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setAttempted(true)
    setFormError(null)
    setFieldErrors({})

    if (!fullName.trim() || !joiningDate.trim()) return

    const input = {
      fullName: fullName.trim(),
      departmentId,
      designation: designation.trim(),
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
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>
            {employeeId ? "Edit Employee" : "Add New Employee"}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="emp-name">Full Name</Label>
            <Input
              id="emp-name"
              value={fullName}
              disabled={pending}
              aria-invalid={Boolean(nameError)}
              onChange={(e) => setFullName(e.target.value)}
            />
            {nameError ? (
              <p role="alert" className="text-sm text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="emp-dept">Department</Label>
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
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.departmentId}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="emp-designation">Designation</Label>
              <Input
                id="emp-designation"
                value={designation}
                disabled={pending}
                onChange={(e) => setDesignation(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="emp-joining">Joining Date</Label>
              <Input
                id="emp-joining"
                type="date"
                value={joiningDate}
                disabled={pending}
                aria-invalid={Boolean(joiningError)}
                onChange={(e) => setJoiningDate(e.target.value)}
              />
              {joiningError ? (
                <p role="alert" className="text-sm text-destructive">
                  {joiningError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="emp-leave">Leave Date</Label>
              <Input
                id="emp-leave"
                type="date"
                value={leaveDate}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.leaveDate)}
                onChange={(e) => setLeaveDate(e.target.value)}
              />
              {fieldErrors.leaveDate ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.leaveDate}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="emp-email">Email</Label>
              <Input
                id="emp-email"
                type="email"
                value={email}
                disabled={pending}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="emp-phone">Phone</Label>
              <Input
                id="emp-phone"
                type="tel"
                value={phone}
                disabled={pending}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isActive}
              disabled={pending}
              onCheckedChange={(checked) => setIsActive(Boolean(checked))}
            />
            Active Employee
          </label>

          <div className="flex flex-col gap-2">
            <Label htmlFor="emp-notes">Notes</Label>
            <Textarea
              id="emp-notes"
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
              : employeeId
                ? "Save Changes"
                : "Save Employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
