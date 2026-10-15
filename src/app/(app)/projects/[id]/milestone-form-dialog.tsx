"use client"

import { useState, useTransition } from "react"

import {
  saveProjectMilestone,
  type ProgressFieldErrors,
} from "@/app/(app)/projects/[id]/progress-actions"
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
import type { ProjectMilestone, ProjectStage } from "@/lib/project-progress"
import { savedToast } from "@/lib/saved"

export function MilestoneFormDialog({
  open,
  onOpenChange,
  projectId,
  milestone,
  stages,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  milestone: ProjectMilestone | null
  stages: readonly ProjectStage[]
}) {
  const [label, setLabel] = useState(milestone?.label ?? "")
  const [stageId, setStageId] = useState(milestone?.stageId || "none")
  const [dueOn, setDueOn] = useState(milestone?.dueOn ?? "")
  const [doneOn, setDoneOn] = useState(milestone?.doneOn ?? "")
  const [percentOfValue, setPercentOfValue] = useState(
    milestone?.percentOfValue === null || milestone?.percentOfValue === undefined
      ? ""
      : String(milestone.percentOfValue),
  )
  const [amount, setAmount] = useState(
    milestone?.amount === null || milestone?.amount === undefined ? "" : String(milestone.amount),
  )
  const [fieldErrors, setFieldErrors] = useState<ProgressFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const stageItems = [
    { value: "none", label: "No Stage" },
    ...stages.map((stage) => ({ value: stage.id, label: stage.name })),
  ]

  function handleSubmit() {
    setFormError(null)
    setFieldErrors({})
    startSubmit(async () => {
      const result = await saveProjectMilestone(projectId, milestone?.id ?? null, {
        label,
        stageId: stageId === "none" ? "" : stageId,
        dueOn,
        doneOn,
        percentOfValue,
        amount,
      })
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
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg" mobileLayout="nav">
        <DialogHeader>
          <DialogTitle>{milestone ? "Edit Milestone" : "Add Milestone"}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(fieldErrors.label) || undefined}>
              <FieldLabel htmlFor="milestone-label">Name</FieldLabel>
              <Input
                id="milestone-label"
                value={label}
                maxLength={160}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.label)}
                onChange={(event) => setLabel(event.target.value)}
              />
              {fieldErrors.label ? <FieldError>{fieldErrors.label}</FieldError> : null}
            </Field>
            <Field>
              <FieldLabel htmlFor="milestone-stage">Stage</FieldLabel>
              <Select
                items={stageItems}
                value={stageId}
                disabled={pending}
                onValueChange={(value) => setStageId(value ?? "none")}
              >
                <SelectTrigger id="milestone-stage" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {stageItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.dueOn) || undefined}>
              <FieldLabel htmlFor="milestone-due-on">Due On</FieldLabel>
              <Input
                id="milestone-due-on"
                type="date"
                value={dueOn}
                autoComplete="off"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.dueOn)}
                onChange={(event) => setDueOn(event.target.value)}
              />
              {fieldErrors.dueOn ? <FieldError>{fieldErrors.dueOn}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.doneOn) || undefined}>
              <FieldLabel htmlFor="milestone-done-on">Done On</FieldLabel>
              <Input
                id="milestone-done-on"
                type="date"
                value={doneOn}
                autoComplete="off"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.doneOn)}
                onChange={(event) => setDoneOn(event.target.value)}
              />
              {fieldErrors.doneOn ? <FieldError>{fieldErrors.doneOn}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.percentOfValue) || undefined}>
              <FieldLabel htmlFor="milestone-percent">Percent Of Value</FieldLabel>
              <Input
                id="milestone-percent"
                value={percentOfValue}
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.percentOfValue)}
                onChange={(event) => setPercentOfValue(event.target.value)}
              />
              {fieldErrors.percentOfValue ? (
                <FieldError>{fieldErrors.percentOfValue}</FieldError>
              ) : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.amount) || undefined}>
              <FieldLabel htmlFor="milestone-amount">Amount</FieldLabel>
              <Input
                id="milestone-amount"
                value={amount}
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="done"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.amount)}
                onChange={(event) => setAmount(event.target.value)}
              />
              {fieldErrors.amount ? <FieldError>{fieldErrors.amount}</FieldError> : null}
            </Field>
          </FieldGroup>
          {formError ? (
            <p role="alert" className="px-1 text-sm text-destructive md:px-0">
              {formError}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" disabled={pending} />}>
            Cancel
          </DialogClose>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Saving…" : "Save Milestone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
