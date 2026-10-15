"use client"

import { useState, useTransition } from "react"

import {
  saveProjectStage,
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
import { Textarea } from "@/components/ui/textarea"
import {
  stageStatuses,
  type ProjectStage,
  type StageStatus,
} from "@/lib/project-progress"
import { savedToast } from "@/lib/saved"

const statusItems = stageStatuses.map((status) => ({ value: status, label: status }))

export function StageFormDialog({
  open,
  onOpenChange,
  projectId,
  stage,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  stage: ProjectStage | null
}) {
  const [name, setName] = useState(stage?.name ?? "")
  const [weight, setWeight] = useState(stage ? String(stage.weight) : "")
  const [status, setStatus] = useState<StageStatus>(stage?.status ?? "Not Started")
  const [plannedStart, setPlannedStart] = useState(stage?.plannedStart ?? "")
  const [plannedEnd, setPlannedEnd] = useState(stage?.plannedEnd ?? "")
  const [doneOn, setDoneOn] = useState(stage?.doneOn ?? "")
  const [notes, setNotes] = useState(stage?.notes ?? "")
  const [fieldErrors, setFieldErrors] = useState<ProgressFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  function handleSubmit() {
    setFormError(null)
    setFieldErrors({})
    startSubmit(async () => {
      const result = await saveProjectStage(projectId, stage?.id ?? null, {
        name,
        weight,
        status,
        plannedStart,
        plannedEnd,
        doneOn,
        notes,
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
          <DialogTitle>{stage ? "Edit Stage" : "Add Stage"}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(fieldErrors.name) || undefined}>
              <FieldLabel htmlFor="stage-name">Name</FieldLabel>
              <Input
                id="stage-name"
                value={name}
                maxLength={120}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.name)}
                onChange={(event) => setName(event.target.value)}
              />
              {fieldErrors.name ? <FieldError>{fieldErrors.name}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.weight) || undefined}>
              <FieldLabel htmlFor="stage-weight">Weight</FieldLabel>
              <Input
                id="stage-weight"
                value={weight}
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.weight)}
                onChange={(event) => setWeight(event.target.value)}
              />
              {fieldErrors.weight ? <FieldError>{fieldErrors.weight}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.status) || undefined}>
              <FieldLabel htmlFor="stage-status">Status</FieldLabel>
              <Select
                items={statusItems}
                value={status}
                disabled={pending}
                onValueChange={(value) => {
                  if (value === "Not Started" || value === "In Progress" || value === "Done") {
                    setStatus(value)
                  }
                }}
              >
                <SelectTrigger id="stage-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  {statusItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.plannedStart) || undefined}>
              <FieldLabel htmlFor="stage-planned-start">Planned Start</FieldLabel>
              <Input
                id="stage-planned-start"
                type="date"
                value={plannedStart}
                autoComplete="off"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.plannedStart)}
                onChange={(event) => setPlannedStart(event.target.value)}
              />
              {fieldErrors.plannedStart ? (
                <FieldError>{fieldErrors.plannedStart}</FieldError>
              ) : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.plannedEnd) || undefined}>
              <FieldLabel htmlFor="stage-planned-end">Planned End</FieldLabel>
              <Input
                id="stage-planned-end"
                type="date"
                value={plannedEnd}
                autoComplete="off"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.plannedEnd)}
                onChange={(event) => setPlannedEnd(event.target.value)}
              />
              {fieldErrors.plannedEnd ? <FieldError>{fieldErrors.plannedEnd}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(fieldErrors.doneOn) || undefined}>
              <FieldLabel htmlFor="stage-done-on">Done On</FieldLabel>
              <Input
                id="stage-done-on"
                type="date"
                value={doneOn}
                autoComplete="off"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.doneOn)}
                onChange={(event) => setDoneOn(event.target.value)}
              />
              {fieldErrors.doneOn ? <FieldError>{fieldErrors.doneOn}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(fieldErrors.notes) || undefined}>
              <FieldLabel htmlFor="stage-notes">Notes</FieldLabel>
              <Textarea
                id="stage-notes"
                value={notes}
                maxLength={4000}
                autoComplete="off"
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.notes)}
                onChange={(event) => setNotes(event.target.value)}
              />
              {fieldErrors.notes ? <FieldError>{fieldErrors.notes}</FieldError> : null}
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
            {pending ? "Saving…" : "Save Stage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
