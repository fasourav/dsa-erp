"use client"

import { savedToast } from "@/lib/saved"
import { useState, useTransition } from "react"

import {
  addProject,
  updateProject,
  type ProjectFormFieldErrors,
} from "@/app/(app)/projects/actions"
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
  FieldLegend,
  FieldSet,
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
import type {
  CatalogOption,
  ClientOption,
  ProjectRow,
  ProjectStatus,
} from "@/lib/project-summary"
import { statusLabel } from "@/lib/project-summary"
import {
  isIsoDate,
  isProjectStatus,
  parseProjectValue,
  todayIsoDate,
} from "@/lib/project-validation"

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: statusLabel("active") },
  { value: "completed", label: statusLabel("completed") },
]

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  clients,
  projectTypes,
  projectPhases,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectRow | null
  clients: ClientOption[]
  projectTypes: CatalogOption[]
  projectPhases: CatalogOption[]
}) {
  const projectId = project?.id ?? null
  const [name, setName] = useState(project?.name ?? "")
  const [clientId, setClientId] = useState(project?.clientId ?? "")
  const [location, setLocation] = useState(project?.location ?? "")
  const [startedOn, setStartedOn] = useState(
    project?.startedOn || todayIsoDate(),
  )
  const [projectType, setProjectType] = useState(project?.projectType ?? "")
  const [status, setStatus] = useState<ProjectStatus>(
    project?.status ?? "active",
  )
  const [phase, setPhase] = useState(project?.phase ?? "")
  const [totalValue, setTotalValue] = useState(
    project ? String(project.totalValue) : "0",
  )
  const [details, setDetails] = useState(project?.details ?? "")
  const [attempted, setAttempted] = useState(false)
  const [serverErrors, setServerErrors] = useState<ProjectFormFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, startSubmit] = useTransition()

  const clientItems = clients.map((client) => ({
    value: client.id,
    label: client.displayName || "—",
  }))
  const typeItems = catalogSelectItems(projectTypes, project?.projectType ?? "")
  const phaseItems = catalogSelectItems(projectPhases, project?.phase ?? "")
  const nameError = serverErrors.name ?? (attempted && !name.trim()
    ? "Enter the project name."
    : null)
  const clientError =
    serverErrors.clientId ??
    (attempted && !clientId ? "Choose a client." : null)
  const dateError =
    serverErrors.startedOn ??
    (attempted && !isIsoDate(startedOn) ? "Enter a start date." : null)
  const typeError = serverErrors.projectType ?? null
  const statusError = serverErrors.status ?? null
  const phaseError = serverErrors.phase ?? null
  const valueError =
    serverErrors.totalValue ??
    (attempted && parseProjectValue(totalValue) === null
      ? totalValue.trim()
        ? "Enter a project value of 0 or more."
        : "Enter a project value."
      : null)

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) {
      return
    }

    onOpenChange(nextOpen)
  }

  function handleSubmit() {
    setAttempted(true)
    setServerErrors({})
    setFormError(null)

    const parsedValue = parseProjectValue(totalValue)
    if (
      !name.trim() ||
      !clientId ||
      !isIsoDate(startedOn) ||
      !isProjectStatus(status) ||
      parsedValue === null
    ) {
      return
    }

    const input = {
      name: name.trim(),
      clientId,
      location: location.trim(),
      startedOn,
      projectType: projectType.trim(),
      status,
      phase: phase.trim(),
      totalValue: totalValue.trim(),
      details: details.trim(),
    }

    startSubmit(async () => {
      try {
        const result = projectId
          ? await updateProject(projectId, input)
          : await addProject(input)

        if (result.fieldErrors) {
          setServerErrors(result.fieldErrors)
          return
        }

        if (result.error) {
          setFormError(result.error)
          return
        }

        savedToast()
        onOpenChange(false)
      } catch {
        setFormError("Could not save this project.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="overflow-hidden sm:max-w-xl"
        mobileLayout="nav"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>
            {projectId ? "Edit Project" : "Add New Project"}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-5">
          <FieldSet>
            <FieldLegend>Project</FieldLegend>
            <FieldGroup layout="inset">
              <Field data-invalid={Boolean(nameError) || undefined}>
                <FieldLabel htmlFor="project-name">Name</FieldLabel>
                <Input
                  id="project-name"
                  maxLength={120}
                  value={name}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  disabled={pending}
                  aria-invalid={Boolean(nameError)}
                  onChange={(event) => setName(event.target.value)}
                />
                {nameError ? <FieldError>{nameError}</FieldError> : null}
              </Field>

              <Field data-invalid={Boolean(clientError) || undefined}>
                <FieldLabel htmlFor="project-client">Client</FieldLabel>
                <Select
                  items={clientItems}
                  value={clientId || null}
                  disabled={pending}
                  onValueChange={(value) => setClientId(value ?? "")}
                >
                  <SelectTrigger
                    id="project-client"
                    className="w-full"
                    aria-invalid={Boolean(clientError)}
                  >
                    <SelectValue placeholder="Select A Client" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {clientItems.map((client) => (
                      <SelectItem key={client.value} value={client.value}>
                        {client.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clientError ? <FieldError>{clientError}</FieldError> : null}
              </Field>

              <Field span="half">
                <FieldLabel htmlFor="project-location">Location</FieldLabel>
                <Input
                  id="project-location"
                  value={location}
                  autoComplete="off"
                  autoCapitalize="words"
                  enterKeyHint="next"
                  disabled={pending}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </Field>
              <Field span="half" data-invalid={Boolean(dateError) || undefined}>
                <FieldLabel htmlFor="project-started-on">Start Date</FieldLabel>
                <Input
                  id="project-started-on"
                  type="date"
                  value={startedOn}
                  disabled={pending}
                  aria-invalid={Boolean(dateError)}
                  onChange={(event) => setStartedOn(event.target.value)}
                />
                {dateError ? <FieldError>{dateError}</FieldError> : null}
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Type And Status</FieldLegend>
            <FieldGroup layout="inset">
              <Field data-invalid={Boolean(typeError) || undefined}>
                <FieldLabel htmlFor="project-type">Project Type</FieldLabel>
                <Select
                  items={typeItems}
                  value={projectType || null}
                  disabled={pending}
                  onValueChange={(value) => setProjectType(value ?? "")}
                >
                  <SelectTrigger
                    id="project-type"
                    className="w-full"
                    aria-invalid={Boolean(typeError)}
                  >
                    <SelectValue placeholder="Select A Type" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {typeItems.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {typeError ? <FieldError>{typeError}</FieldError> : null}
              </Field>

              <Field span="half" data-invalid={Boolean(statusError) || undefined}>
                <FieldLabel htmlFor="project-status">Status</FieldLabel>
                <Select
                  items={statusOptions}
                  value={status}
                  disabled={pending}
                  onValueChange={(value) => {
                    if (value && isProjectStatus(value)) {
                      setStatus(value)
                    }
                  }}
                >
                  <SelectTrigger
                    id="project-status"
                    className="w-full"
                    aria-invalid={Boolean(statusError)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {statusError ? <FieldError>{statusError}</FieldError> : null}
              </Field>
              <Field span="half" data-invalid={Boolean(phaseError) || undefined}>
                <FieldLabel htmlFor="project-phase">Project Phase</FieldLabel>
                <Select
                  items={phaseItems}
                  value={phase || null}
                  disabled={pending}
                  onValueChange={(value) => setPhase(value ?? "")}
                >
                  <SelectTrigger
                    id="project-phase"
                    className="w-full"
                    aria-invalid={Boolean(phaseError)}
                  >
                    <SelectValue placeholder="Select A Phase" />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {phaseItems.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {phaseError ? <FieldError>{phaseError}</FieldError> : null}
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldLegend>Value</FieldLegend>
            <FieldGroup layout="inset">
              <Field data-invalid={Boolean(valueError) || undefined}>
                <FieldLabel htmlFor="project-value">Project Value</FieldLabel>
                <Input
                  id="project-value"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={totalValue}
                  disabled={pending}
                  aria-invalid={Boolean(valueError)}
                  onChange={(event) => setTotalValue(event.target.value)}
                />
                {valueError ? <FieldError>{valueError}</FieldError> : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="project-details">Details</FieldLabel>
                <Textarea
                  id="project-details"
                  value={details}
                  disabled={pending}
                  onChange={(event) => setDetails(event.target.value)}
                />
              </Field>
            </FieldGroup>
          </FieldSet>

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
            {pending ? "Saving…" : projectId ? "Save Changes" : "Save Project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function catalogSelectItems(options: readonly CatalogOption[], savedName: string) {
  const items = options.map((option) => ({
    id: option.id,
    value: option.name,
    label: option.name,
  }))
  const saved = savedName.trim()

  if (saved && !items.some((item) => item.value === saved)) {
    items.push({ id: `saved:${saved}`, value: saved, label: saved })
  }

  return items
}
