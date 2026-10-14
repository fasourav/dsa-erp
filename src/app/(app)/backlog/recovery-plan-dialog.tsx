"use client"

import { savedToast } from "@/lib/saved"
import { useState, useTransition } from "react"

import { saveRecoveryPlan } from "@/app/(app)/backlog/actions"
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
import { Textarea } from "@/components/ui/textarea"
import type { BacklogRow } from "@/lib/backlog"
import {
  countWords,
  RECOVERY_PLAN_WORD_LIMIT,
  recoveryPlanError,
} from "@/lib/recovery-plan"
import { cn } from "@/lib/utils"

export function RecoveryPlanDialog({
  open,
  onOpenChange,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: BacklogRow | null
}) {
  const projectId = project?.id ?? ""
  const [plan, setPlan] = useState(project?.recoveryPlan ?? "")
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()
  const words = countWords(plan)
  const overLimit = words > RECOVERY_PLAN_WORD_LIMIT

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) {
      return
    }

    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setFormError(null)
    const wordError = recoveryPlanError(plan)
    setFieldError(wordError)
    if (wordError || !projectId) {
      return
    }

    startSubmit(async () => {
      try {
        const result = await saveRecoveryPlan(projectId, plan)
        if (result.fieldErrors?.recoveryPlan) {
          setFieldError(result.fieldErrors.recoveryPlan)
          return
        }
        if (result.error) {
          setFormError(result.error)
          return
        }
        savedToast()
        onOpenChange(false)
      } catch {
        setFormError("Could not save this recovery plan.")
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
            {project?.recoveryPlan ? "Edit Recovery Plan" : "Add Recovery Plan"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {project?.projectName ? (
            <p className="px-1 text-sm text-muted-foreground md:px-0">{project.projectName}</p>
          ) : null}
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(fieldError) || undefined}>
              <FieldLabel htmlFor="recovery-plan">Recovery Plan</FieldLabel>
              <Textarea
                id="recovery-plan"
                value={plan}
                disabled={pending}
                aria-invalid={Boolean(fieldError)}
                onChange={(event) => {
                  setPlan(event.target.value)
                  setFieldError(null)
                }}
              />
              <FieldDescription
                className={cn(overLimit || fieldError ? "text-destructive" : undefined)}
              >
                {words} / {RECOVERY_PLAN_WORD_LIMIT} Words
              </FieldDescription>
              {fieldError ? <FieldError>{fieldError}</FieldError> : null}
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
            {pending ? "Saving…" : "Save Recovery Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
