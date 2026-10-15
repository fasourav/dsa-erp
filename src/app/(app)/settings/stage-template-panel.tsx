"use client"

import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"

import {
  deleteStageTemplate,
  moveStageTemplate,
  saveStageTemplate,
} from "@/app/(app)/settings/stage-template-actions"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
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
import { Empty, EmptyTitle } from "@/components/ui/empty"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { savedToast } from "@/lib/saved"
import type { StageTemplate } from "@/lib/project-progress"

export function StageTemplatePanel({
  templates,
  onBack,
}: {
  templates: StageTemplate[]
  onBack: () => void
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [session, setSession] = useState(0)
  const [editing, setEditing] = useState<StageTemplate | null>(null)
  const [pendingDelete, setPendingDelete] = useState<StageTemplate | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()
  const [moving, startMove] = useTransition()

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft aria-hidden="true" data-icon="inline-start" />
          Settings
        </Button>
        <Button
          type="button"
          onClick={() => {
            setEditing(null)
            setSession((current) => current + 1)
            setFormOpen(true)
          }}
        >
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add Stage
        </Button>
      </div>
      <div className="overflow-hidden rounded-card glass-panel">
        {templates.length === 0 ? (
          <Empty>
            <EmptyTitle>No Default Stages Yet</EmptyTitle>
          </Empty>
        ) : (
          <ul>
            {templates.map((template, index) => (
              <li
                key={template.id}
                className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 md:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ui font-semibold">{template.name}</p>
                  <p className="text-caption text-muted-foreground tabular-nums">
                    Weight {template.weight}%
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={moving || index === 0}
                  onClick={() =>
                    startMove(async () => {
                      const result = await moveStageTemplate(template.id, "up")
                      if (!result.error) savedToast("Stage moved.")
                    })
                  }
                >
                  Up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={moving || index === templates.length - 1}
                  onClick={() =>
                    startMove(async () => {
                      const result = await moveStageTemplate(template.id, "down")
                      if (!result.error) savedToast("Stage moved.")
                    })
                  }
                >
                  Down
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Edit ${template.name}`}
                  onClick={() => {
                    setEditing(template)
                    setSession((current) => current + 1)
                    setFormOpen(true)
                  }}
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${template.name}`}
                  onClick={() => {
                    setDeleteError(null)
                    setPendingDelete(template)
                  }}
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <TemplateFormDialog
        key={session}
        open={formOpen}
        onOpenChange={setFormOpen}
        template={editing}
      />
      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (open || deleting) return
          setPendingDelete(null)
          setDeleteError(null)
        }}
        title="Delete Stage"
        itemName={pendingDelete?.name}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={() => {
          if (!pendingDelete) return
          const id = pendingDelete.id
          startDelete(async () => {
            const result = await deleteStageTemplate(id)
            if (result.error) {
              setDeleteError(result.error)
              return
            }
            setPendingDelete(null)
            savedToast("Deleted.")
          })
        }}
      />
    </div>
  )
}

function TemplateFormDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: StageTemplate | null
}) {
  const [name, setName] = useState(template?.name ?? "")
  const [weight, setWeight] = useState(template ? String(template.weight) : "")
  const [nameError, setNameError] = useState<string | null>(null)
  const [weightError, setWeightError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg" mobileLayout="nav">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Stage" : "Add Stage"}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <FieldGroup layout="inset">
            <Field data-invalid={Boolean(nameError) || undefined}>
              <FieldLabel htmlFor="template-name">Name</FieldLabel>
              <Input
                id="template-name"
                value={name}
                maxLength={120}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(nameError)}
                onChange={(event) => setName(event.target.value)}
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(weightError) || undefined}>
              <FieldLabel htmlFor="template-weight">Weight</FieldLabel>
              <Input
                id="template-weight"
                value={weight}
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="done"
                disabled={pending}
                aria-invalid={Boolean(weightError)}
                onChange={(event) => setWeight(event.target.value)}
              />
              {weightError ? <FieldError>{weightError}</FieldError> : null}
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
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              setNameError(null)
              setWeightError(null)
              setFormError(null)
              startSubmit(async () => {
                const result = await saveStageTemplate(template?.id ?? null, { name, weight })
                if (result.fieldErrors) {
                  setNameError(result.fieldErrors.name ?? null)
                  setWeightError(result.fieldErrors.weight ?? null)
                  return
                }
                if (result.error) {
                  setFormError(result.error)
                  return
                }
                savedToast()
                onOpenChange(false)
              })
            }}
          >
            {pending ? "Saving…" : "Save Stage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
