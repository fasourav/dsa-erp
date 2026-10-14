"use client"

import { savedToast } from "@/lib/saved"
import { useState, useTransition } from "react"

import {
  addLead,
  updateLead,
  type LeadFieldErrors,
} from "@/app/(app)/leads/actions"
import { NameCombobox } from "@/components/name-combobox"
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
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import type { LeadLookups, LeadRow } from "@/lib/leads"
import { isIsoDate, todayIsoDate } from "@/lib/project-validation"

export function LeadFormDialog({
  open,
  onOpenChange,
  lead,
  lookups,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lead: LeadRow | null
  lookups: LeadLookups
}) {
  const leadId = lead?.id ?? null
  const defaultStatus = lookups.statuses[0]?.code ?? "open"
  const [leadName, setLeadName] = useState(lead?.leadName ?? "")
  const [addedOn, setAddedOn] = useState(lead?.addedOn || todayIsoDate())
  const [kind, setKind] = useState<string>(lead?.kind ?? "")
  const [phone, setPhone] = useState(lead?.phone ?? "")
  const [email, setEmail] = useState(lead?.email ?? "")
  const [projectName, setProjectName] = useState(lead?.projectName ?? "")
  const [projectType, setProjectType] = useState(lead?.projectType ?? "")
  const [source, setSource] = useState(lead?.source ?? "")
  const [estimatedValue, setEstimatedValue] = useState(
    lead ? String(lead.estimatedValue || "") : "",
  )
  const [currentStage, setCurrentStage] = useState(lead?.currentStage ?? "")
  const [status, setStatus] = useState(lead?.status ?? defaultStatus)
  const [probability, setProbability] = useState(
    lead && Number.isFinite(lead.probability) ? String(lead.probability) : "20",
  )
  const [notes, setNotes] = useState(lead?.notes ?? "")

  const [attempted, setAttempted] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<LeadFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const nameError =
    attempted && !leadName.trim()
      ? "Enter the lead name."
      : fieldErrors.leadName
  const addedOnError =
    fieldErrors.addedOn ??
    (attempted && !isIsoDate(addedOn) ? "Enter the lead add date." : null)
  const kindError =
    attempted && !kind ? "Choose a lead type." : fieldErrors.kind

  const typeItems = lookups.leadTypes.map((item) => ({
    value: item.code,
    label: item.name,
  }))
  const ptItems = lookups.projectTypes.map((t) => ({
    value: t.name,
    label: t.name,
  }))
  const savedType = lead?.projectType.trim() ?? ""
  if (savedType && !ptItems.some((item) => item.value === savedType)) {
    ptItems.push({ value: savedType, label: savedType })
  }

  const sourceNames = withSavedName(
    lookups.sources.map((item) => item.name),
    lead?.source,
  )
  const stageNames = withSavedName(
    lookups.stages.map((item) => item.name),
    lead?.currentStage,
  )
  const statusItems = lookups.statuses.map((item) => ({
    value: item.code,
    label: item.name,
  }))
  const probabilityValue = Number(probability)
  const probabilityNumber = Number.isFinite(probabilityValue)
    ? Math.min(100, Math.max(0, Math.round(probabilityValue)))
    : 0

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setAttempted(true)
    setFormError(null)
    setFieldErrors({})

    if (!leadName.trim() || !kind || !isIsoDate(addedOn)) return

    const input = {
      leadName: leadName.trim(),
      addedOn,
      kind,
      phone: phone.trim(),
      email: email.trim(),
      projectName: projectName.trim(),
      projectType,
      source: source.trim(),
      estimatedValue: estimatedValue.trim(),
      currentStage: currentStage.trim(),
      status,
      probability: String(probabilityNumber),
      notes: notes.trim(),
    }

    startSubmit(async () => {
      try {
        const result = leadId
          ? await updateLead(leadId, input)
          : await addLead(input)

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
        setFormError("Could not save this lead.")
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
          <DialogTitle>{leadId ? "Edit Lead" : "Add New Lead"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <FieldGroup layout="inset">
            <Field span="half" data-invalid={Boolean(nameError) || undefined}>
              <FieldLabel htmlFor="lead-name">Lead Name</FieldLabel>
              <Input
                id="lead-name"
                value={leadName}
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                aria-invalid={Boolean(nameError)}
                onChange={(e) => setLeadName(e.target.value)}
              />
              {nameError ? <FieldError>{nameError}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(kindError) || undefined}>
              <FieldLabel htmlFor="lead-type">Lead Type</FieldLabel>
              <Select
                items={typeItems}
                value={kind || null}
                disabled={pending}
                onValueChange={(v) => setKind(v ?? "")}
              >
                <SelectTrigger
                  id="lead-type"
                  className="w-full"
                  aria-invalid={Boolean(kindError)}
                >
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent align="start">
                  {typeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {kindError ? <FieldError>{kindError}</FieldError> : null}
            </Field>

            <Field data-invalid={Boolean(addedOnError) || undefined}>
              <FieldLabel htmlFor="lead-added-on">Lead Add Date</FieldLabel>
              <Input
                id="lead-added-on"
                type="date"
                value={addedOn}
                disabled={pending}
                aria-invalid={Boolean(addedOnError)}
                onChange={(event) => setAddedOn(event.target.value)}
              />
              {addedOnError ? <FieldError>{addedOnError}</FieldError> : null}
            </Field>

            <Field span="half" data-invalid={Boolean(fieldErrors.phone) || undefined}>
              <FieldLabel htmlFor="lead-phone">Contact Number</FieldLabel>
              <Input
                id="lead-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                enterKeyHint="next"
                value={phone}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.phone)}
                onChange={(e) => setPhone(e.target.value)}
              />
              {fieldErrors.phone ? <FieldError>{fieldErrors.phone}</FieldError> : null}
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.email) || undefined}>
              <FieldLabel htmlFor="lead-email">Email</FieldLabel>
              <Input
                id="lead-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                value={email}
                disabled={pending}
                aria-invalid={Boolean(fieldErrors.email)}
                onChange={(e) => setEmail(e.target.value)}
              />
              {fieldErrors.email ? <FieldError>{fieldErrors.email}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="lead-project-name">Project Name</FieldLabel>
              <Input
                id="lead-project-name"
                value={projectName}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="next"
                disabled={pending}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </Field>

            <Field span="half">
              <FieldLabel htmlFor="lead-ptype">Project Type</FieldLabel>
              <Select
                items={ptItems}
                value={projectType || null}
                disabled={pending}
                onValueChange={(v) => setProjectType(v ?? "")}
              >
                <SelectTrigger id="lead-ptype" className="w-full">
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent align="start">
                  {ptItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field span="half">
              <FieldLabel htmlFor="lead-source">Source</FieldLabel>
              <NameCombobox
                id="lead-source"
                value={source}
                names={sourceNames}
                disabled={pending}
                placeholder="Type Or Select Source"
                onValueChange={setSource}
              />
            </Field>

            <Field span="half">
              <FieldLabel htmlFor="lead-value">Estimated Value</FieldLabel>
              <Input
                id="lead-value"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={estimatedValue}
                disabled={pending}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </Field>
            <Field span="half">
              <div className="flex items-center justify-between gap-2">
                <FieldLabel htmlFor="lead-prob">Probability</FieldLabel>
                <span className="text-label tabular-nums text-muted-foreground">
                  {probabilityNumber}%
                </span>
              </div>
              <Slider
                id="lead-prob"
                min={0}
                max={100}
                step={1}
                value={[probabilityNumber]}
                disabled={pending}
                onValueChange={(values) => {
                  const next = Array.isArray(values)
                    ? values[0]
                    : (values as number)
                  setProbability(String(next ?? 0))
                }}
              />
            </Field>

            <Field span="half">
              <FieldLabel htmlFor="lead-stage">Stage</FieldLabel>
              <NameCombobox
                id="lead-stage"
                value={currentStage}
                names={stageNames}
                disabled={pending}
                placeholder="Type Or Select Stage"
                onValueChange={setCurrentStage}
              />
            </Field>
            <Field span="half" data-invalid={Boolean(fieldErrors.status) || undefined}>
              <FieldLabel htmlFor="lead-status">Status</FieldLabel>
              <Select
                items={statusItems}
                value={status}
                disabled={pending}
                onValueChange={(v) => setStatus((v as typeof status) ?? defaultStatus)}
              >
                <SelectTrigger
                  id="lead-status"
                  className="w-full"
                  aria-invalid={Boolean(fieldErrors.status)}
                >
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent align="start">
                  {statusItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.status ? <FieldError>{fieldErrors.status}</FieldError> : null}
            </Field>

            <Field>
              <FieldLabel htmlFor="lead-notes">Notes</FieldLabel>
              <Textarea
                id="lead-notes"
                value={notes}
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
            {pending ? "Saving…" : leadId ? "Save Changes" : "Save Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function withSavedName(names: string[], saved: string | undefined) {
  const value = saved?.trim() ?? ""
  if (value && !names.some((name) => name === value)) {
    return [...names, value]
  }
  return names
}
