"use client"

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
import { Label } from "@/components/ui/label"
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
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>
            {project?.recoveryPlan ? "Edit Recovery Plan" : "Add Recovery Plan"}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          {project?.projectName ? (
            <p className="text-sm text-muted-foreground">{project.projectName}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor="recovery-plan">Recovery Plan</Label>
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
            <p
              className={cn(
                "text-sm",
                overLimit || fieldError
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              {words} / {RECOVERY_PLAN_WORD_LIMIT} Words
            </p>
            {fieldError ? (
              <p role="alert" className="text-sm text-destructive">
                {fieldError}
              </p>
            ) : null}
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
            {pending ? "Saving…" : "Save Recovery Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
