"use client"

import { Copy, Pencil, Plus, Trash2 } from "lucide-react"
import { useState, useTransition } from "react"

import {
  deleteDocumentTemplate,
  duplicateDocumentTemplate,
  saveDocumentTemplate,
} from "@/app/(app)/settings/document-template-actions"
import { DeleteConfirmDialog } from "@/components/delete-confirm-dialog"
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
import { Empty, EmptyTitle } from "@/components/ui/empty"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
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
  kindLabel,
  nextCopyName,
  type DocumentTemplate,
  type DocumentTemplateKind,
  type DocumentTemplateLine,
  type DocumentTemplateMilestone,
} from "@/lib/document-templates"
import { toast } from "sonner"

import { savedToast } from "@/lib/saved"
import type { DocumentTemplateInput } from "@/lib/schemas"

const kinds: { value: DocumentTemplateKind; label: string }[] = [
  { value: "quotation", label: "Quotation" },
  { value: "work_order", label: "Work Order" },
]

export function DocumentTemplatePanel({
  templates,
  projectTypes,
}: {
  templates: DocumentTemplate[]
  projectTypes: readonly string[]
}) {
  const [formOpen, setFormOpen] = useState(false)
  const [session, setSession] = useState(0)
  const [editing, setEditing] = useState<DocumentTemplate | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DocumentTemplate | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, startDelete] = useTransition()
  const [duplicating, startDuplicate] = useTransition()

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          onClick={() => {
            setEditing(null)
            setSession((current) => current + 1)
            setFormOpen(true)
          }}
        >
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add Template
        </Button>
      </div>
      <div className="overflow-hidden rounded-card glass-panel">
        {templates.length === 0 ? (
          <Empty>
            <EmptyTitle>No Document Templates Yet</EmptyTitle>
          </Empty>
        ) : (
          <ul>
            {templates.map((template) => (
              <li
                key={template.id}
                className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 md:px-6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ui font-semibold">{template.name}</p>
                  <p className="text-caption text-muted-foreground">
                    {kindLabel(template.kind)}
                    {template.projectType ? ` · ${template.projectType}` : ""}
                    {template.isActive ? "" : " · Inactive"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Duplicate ${template.name}`}
                  disabled={duplicating}
                  onClick={() =>
                    startDuplicate(async () => {
                      const result = await duplicateDocumentTemplate(
                        template.id,
                        nextCopyName(
                          template.name,
                          templates.filter((item) => item.kind === template.kind).map((item) => item.name),
                        ),
                      )
                      if (result.error) toast.error(result.error)
                      else savedToast("Template duplicated.")
                    })
                  }
                >
                  <Copy aria-hidden="true" className="size-4" />
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
        projectTypes={projectTypes}
      />
      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (open || deleting) return
          setPendingDelete(null)
          setDeleteError(null)
        }}
        title="Delete Template"
        itemName={pendingDelete?.name}
        error={deleteError}
        pending={deleting}
        confirmKey={pendingDelete?.id}
        onConfirm={() => {
          if (!pendingDelete) return
          const id = pendingDelete.id
          startDelete(async () => {
            const result = await deleteDocumentTemplate(id)
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
  projectTypes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: DocumentTemplate | null
  projectTypes: readonly string[]
}) {
  const [kind, setKind] = useState<DocumentTemplateKind>(template?.kind ?? "quotation")
  const [name, setName] = useState(template?.name ?? "")
  const [projectType, setProjectType] = useState(template?.projectType ?? "")
  const [scopeText, setScopeText] = useState(template?.scopeText ?? "")
  const [termsText, setTermsText] = useState(template?.termsText ?? "")
  const [paymentTerms, setPaymentTerms] = useState(template?.paymentTerms ?? "")
  const [lines, setLines] = useState<DocumentTemplateLine[]>(template?.lines ?? [])
  const [milestones, setMilestones] = useState<DocumentTemplateMilestone[]>(
    template?.milestones ?? [],
  )
  const [isActive, setIsActive] = useState(template?.isActive ?? true)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof DocumentTemplateInput, string>>>(
    {},
  )
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()
  const typeItems = ["", ...projectTypes]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden sm:max-w-lg" mobileLayout="nav">
        <DialogHeader>
          <DialogTitle>{template ? "Edit Template" : "Add Template"}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <FieldGroup layout="inset">
            <Field span="half" data-invalid={Boolean(fieldErrors.kind) || undefined}>
              <FieldLabel htmlFor="template-kind">Kind</FieldLabel>
              <Select
                items={kinds}
                value={kind}
                onValueChange={(value) => {
                  if (value === "quotation" || value === "work_order") setKind(value)
                }}
              >
                <SelectTrigger id="template-kind" disabled={pending} aria-invalid={Boolean(fieldErrors.kind)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {kinds.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.kind ? <FieldError>{fieldErrors.kind}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.name) || undefined}>
              <FieldLabel htmlFor="template-name">Name</FieldLabel>
              <Input
                id="template-name"
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
            <Field data-invalid={Boolean(fieldErrors.projectType) || undefined}>
              <FieldLabel htmlFor="template-project-type">Project Type</FieldLabel>
              <Select
                items={typeItems.map((item) => ({
                  value: item || "none",
                  label: item || "Any Project Type",
                }))}
                value={projectType || "none"}
                onValueChange={(value) => setProjectType(value === "none" || !value ? "" : value)}
              >
                <SelectTrigger
                  id="template-project-type"
                  disabled={pending}
                  aria-invalid={Boolean(fieldErrors.projectType)}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Any Project Type</SelectItem>
                  {projectTypes.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.projectType ? <FieldError>{fieldErrors.projectType}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(fieldErrors.scopeText) || undefined}>
              <FieldLabel htmlFor="template-scope">Scope</FieldLabel>
              <Textarea
                id="template-scope"
                value={scopeText}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.scopeText)}
                onChange={(event) => setScopeText(event.target.value)}
              />
              {fieldErrors.scopeText ? <FieldError>{fieldErrors.scopeText}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(fieldErrors.termsText) || undefined}>
              <FieldLabel htmlFor="template-terms">Terms</FieldLabel>
              <Textarea
                id="template-terms"
                value={termsText}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.termsText)}
                onChange={(event) => setTermsText(event.target.value)}
              />
              {fieldErrors.termsText ? <FieldError>{fieldErrors.termsText}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(fieldErrors.paymentTerms) || undefined}>
              <FieldLabel htmlFor="template-payment">Payment Terms</FieldLabel>
              <Textarea
                id="template-payment"
                value={paymentTerms}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.paymentTerms)}
                onChange={(event) => setPaymentTerms(event.target.value)}
              />
              {fieldErrors.paymentTerms ? <FieldError>{fieldErrors.paymentTerms}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(fieldErrors.lines) || undefined}>
              <FieldTitle>Lines</FieldTitle>
              <div className="flex flex-col gap-3">
                {lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <Input
                      value={line.description}
                      placeholder="Description"
                      autoComplete="off"
                      disabled={pending}
                      onChange={(event) => {
                        const next = lines.slice()
                        next[index] = { ...line, description: event.target.value }
                        setLines(next)
                      }}
                    />
                    <Input
                      value={line.unit}
                      placeholder="Unit"
                      autoComplete="off"
                      disabled={pending}
                      onChange={(event) => {
                        const next = lines.slice()
                        next[index] = { ...line, unit: event.target.value }
                        setLines(next)
                      }}
                    />
                    <Input
                      value={line.qty}
                      placeholder="Qty"
                      inputMode="decimal"
                      autoComplete="off"
                      disabled={pending}
                      onChange={(event) => {
                        const next = lines.slice()
                        next[index] = { ...line, qty: event.target.value }
                        setLines(next)
                      }}
                    />
                    <div className="flex flex-col gap-1">
                      <Input
                        value={line.rate}
                        placeholder="Rate"
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={pending}
                        onChange={(event) => {
                          const next = lines.slice()
                          next[index] = { ...line, rate: event.target.value }
                          setLines(next)
                        }}
                      />
                      {Number.isFinite(Number(line.rate.replace(/,/g, ""))) ? (
                        <p className="text-caption text-muted-foreground">
                          <Money value={Number(line.rate.replace(/,/g, ""))} />
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => setLines(lines.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      Remove Line
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || lines.length >= 40}
                  onClick={() =>
                    setLines([...lines, { description: "", unit: "", qty: "1", rate: "0" }])
                  }
                >
                  Add Line
                </Button>
              </div>
              {fieldErrors.lines ? <FieldError>{fieldErrors.lines}</FieldError> : null}
            </Field>
            <Field data-invalid={Boolean(fieldErrors.milestones) || undefined}>
              <FieldTitle>Milestones</FieldTitle>
              <div className="flex flex-col gap-3">
                {milestones.map((milestone, index) => (
                  <div key={index} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <Input
                      value={milestone.label}
                      placeholder="Label"
                      autoComplete="off"
                      disabled={pending}
                      onChange={(event) => {
                        const next = milestones.slice()
                        next[index] = { ...milestone, label: event.target.value }
                        setMilestones(next)
                      }}
                    />
                    <Input
                      value={milestone.percent}
                      placeholder="Percent"
                      inputMode="decimal"
                      autoComplete="off"
                      disabled={pending}
                      onChange={(event) => {
                        const next = milestones.slice()
                        next[index] = { ...milestone, percent: event.target.value }
                        setMilestones(next)
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        setMilestones(milestones.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending || milestones.length >= 12}
                  onClick={() => setMilestones([...milestones, { label: "", percent: "" }])}
                >
                  Add Milestone
                </Button>
              </div>
              {fieldErrors.milestones ? <FieldError>{fieldErrors.milestones}</FieldError> : null}
            </Field>
            <Field>
              <FieldTitle id="template-active-label">Status</FieldTitle>
              <label className="flex min-h-11 items-center gap-2.5 text-base md:min-h-0 md:text-sm">
                <Checkbox
                  checked={isActive}
                  disabled={pending}
                  onCheckedChange={(checked) => setIsActive(checked === true)}
                />
                Active
              </label>
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
              setFieldErrors({})
              setFormError(null)
              startSubmit(async () => {
                const result = await saveDocumentTemplate(template?.id ?? null, {
                  kind,
                  name,
                  projectType,
                  scopeText,
                  termsText,
                  paymentTerms,
                  lines,
                  milestones,
                  isActive,
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
            }}
          >
            {pending ? "Saving…" : "Save Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
