"use client"

import { useState, useTransition } from "react"

import {
  addLead,
  updateLead,
  type LeadFieldErrors,
} from "@/app/(app)/leads/actions"
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
import type { LeadLookups, LeadRow } from "@/lib/leads"

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
    lead ? String(lead.probability || "") : "",
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

  const sourceItems = withSavedOption(
    lookups.sources.map((item) => ({ value: item.name, label: item.name })),
    lead?.source,
  )
  const stageItems = withSavedOption(
    lookups.stages.map((item) => ({ value: item.name, label: item.name })),
    lead?.currentStage,
  )
  const statusItems = lookups.statuses.map((item) => ({
    value: item.code,
    label: item.name,
  }))

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return
    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setAttempted(true)
    setFormError(null)
    setFieldErrors({})

    if (!leadName.trim() || !kind) return

    const input = {
      leadName: leadName.trim(),
      kind,
      phone: phone.trim(),
      email: email.trim(),
      projectName: projectName.trim(),
      projectType,
      source: source.trim(),
      estimatedValue: estimatedValue.trim(),
      currentStage: currentStage.trim(),
      status,
      probability: probability.trim(),
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
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>{leadId ? "Edit Lead" : "Add New Lead"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-name">Lead Name</Label>
              <Input
                id="lead-name"
                value={leadName}
                disabled={pending}
                aria-invalid={Boolean(nameError)}
                onChange={(e) => setLeadName(e.target.value)}
              />
              {nameError ? (
                <p role="alert" className="text-sm text-destructive">
                  {nameError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-type">Lead Type</Label>
              <Select
                items={typeItems}
                value={kind || null}
                disabled={pending}
                onValueChange={(v) => setKind(v ?? "")}
              >
                <SelectTrigger id="lead-type" className="w-full">
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
              {kindError ? (
                <p role="alert" className="text-sm text-destructive">
                  {kindError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-phone">Contact Number</Label>
              <Input
                id="lead-phone"
                type="tel"
                value={phone}
                disabled={pending}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={email}
                disabled={pending}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-project-name">Project Name</Label>
            <Input
              id="lead-project-name"
              value={projectName}
              disabled={pending}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-ptype">Project Type</Label>
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
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-source">Source</Label>
              <Select
                items={sourceItems}
                value={source || null}
                disabled={pending}
                onValueChange={(v) => setSource(v ?? "")}
              >
                <SelectTrigger id="lead-source" className="w-full">
                  <SelectValue placeholder="Select Source" />
                </SelectTrigger>
                <SelectContent align="start">
                  {sourceItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-value">Estimated Value</Label>
              <Input
                id="lead-value"
                type="number"
                step="0.01"
                value={estimatedValue}
                disabled={pending}
                onChange={(e) => setEstimatedValue(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-prob">Probability (%)</Label>
              <Input
                id="lead-prob"
                type="number"
                min="0"
                max="100"
                value={probability}
                disabled={pending}
                onChange={(e) => setProbability(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-stage">Stage</Label>
              <Select
                items={stageItems}
                value={currentStage || null}
                disabled={pending}
                onValueChange={(v) => setCurrentStage(v ?? "")}
              >
                <SelectTrigger id="lead-stage" className="w-full">
                  <SelectValue placeholder="Select Stage" />
                </SelectTrigger>
                <SelectContent align="start">
                  {stageItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="lead-status">Status</Label>
              <Select
                items={statusItems}
                value={status}
                disabled={pending}
                onValueChange={(v) => setStatus((v as typeof status) ?? defaultStatus)}
              >
                <SelectTrigger id="lead-status" className="w-full">
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
              {fieldErrors.status ? (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.status}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea
              id="lead-notes"
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
            {pending ? "Saving…" : leadId ? "Save Changes" : "Save Lead"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function withSavedOption(
  items: { value: string; label: string }[],
  saved: string | undefined,
) {
  const value = saved?.trim() ?? ""
  if (value && !items.some((item) => item.value === value)) {
    items.push({ value, label: value })
  }
  return items
}
