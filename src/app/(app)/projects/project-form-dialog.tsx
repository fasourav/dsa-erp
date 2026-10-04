"use client"

import { useState, useTransition } from "react"

import {
  addProject,
  updateProject,
  type ProjectFormFieldErrors,
} from "@/app/(app)/projects/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
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
import type { ClientOption, ProjectRow, ProjectStatus } from "@/lib/project-summary"
import {
  projectPhaseOptions,
  projectTypeOptions,
  statusLabel,
} from "@/lib/project-summary"
import {
  isIsoDate,
  isProjectPhase,
  isProjectStatus,
  isProjectType,
  parseProjectValue,
  todayIsoDate,
} from "@/lib/project-validation"

const statusOptions: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: statusLabel("active") },
  { value: "completed", label: statusLabel("completed") },
]

const typeItems = projectTypeOptions.map((option) => ({
  value: option,
  label: option,
}))

const phaseItems = projectPhaseOptions.map((option) => ({
  value: option,
  label: option,
}))

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  clients,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: ProjectRow | null
  clients: ClientOption[]
}) {
  const projectId = project?.id ?? null
  const [name, setName] = useState(project?.name ?? "")
  const [clientId, setClientId] = useState(project?.clientId ?? "")
  const [location, setLocation] = useState(project?.location ?? "")
  const [startedOn, setStartedOn] = useState(
    project?.startedOn || todayIsoDate(),
  )
  const [projectType, setProjectType] = useState(
    project && isProjectType(project.projectType) ? project.projectType : "",
  )
  const [status, setStatus] = useState<ProjectStatus>(
    project?.status ?? "active",
  )
  const [phase, setPhase] = useState(
    project && isProjectPhase(project.phase) ? project.phase : "",
  )
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
  const nameError = serverErrors.name ?? (attempted && !name.trim()
    ? "Enter the project name."
    : null)
  const clientError =
    serverErrors.clientId ??
    (attempted && !clientId ? "Choose a client." : null)
  const dateError =
    serverErrors.startedOn ??
    (attempted && !isIsoDate(startedOn) ? "Enter a start date." : null)
  const typeError =
    serverErrors.projectType ??
    (attempted && projectType && !isProjectType(projectType)
      ? "Choose a project type."
      : null)
  const statusError = serverErrors.status ?? null
  const phaseError =
    serverErrors.phase ??
    (attempted && phase && !isProjectPhase(phase)
      ? "Choose a project phase."
      : null)
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
      (projectType !== "" && !isProjectType(projectType)) ||
      (phase !== "" && !isProjectPhase(phase)) ||
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

        onOpenChange(false)
      } catch {
        setFormError("Could not save this project.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>
            {projectId ? "Edit project" : "Add New Project"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={name}
              disabled={pending}
              aria-invalid={Boolean(nameError)}
              onChange={(event) => setName(event.target.value)}
            />
            {nameError ? (
              <p role="alert" className="text-sm text-destructive">
                {nameError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-client">Client</Label>
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
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent align="start">
                {clientItems.map((client) => (
                  <SelectItem key={client.value} value={client.value}>
                    {client.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {clientError ? (
              <p role="alert" className="text-sm text-destructive">
                {clientError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-location">Location</Label>
              <Input
                id="project-location"
                value={location}
                disabled={pending}
                onChange={(event) => setLocation(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-started-on">Start date</Label>
              <Input
                id="project-started-on"
                type="date"
                value={startedOn}
                disabled={pending}
                aria-invalid={Boolean(dateError)}
                onChange={(event) => setStartedOn(event.target.value)}
              />
              {dateError ? (
                <p role="alert" className="text-sm text-destructive">
                  {dateError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-type">Type</Label>
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
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent align="start">
                {typeItems.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {typeError ? (
              <p role="alert" className="text-sm text-destructive">
                {typeError}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-status">Status</Label>
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
              {statusError ? (
                <p role="alert" className="text-sm text-destructive">
                  {statusError}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-phase">Phase</Label>
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
                  <SelectValue placeholder="Select a phase" />
                </SelectTrigger>
                <SelectContent align="start">
                  {phaseItems.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {phaseError ? (
                <p role="alert" className="text-sm text-destructive">
                  {phaseError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-value">Project value</Label>
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
              {valueError ? (
                <p role="alert" className="text-sm text-destructive">
                  {valueError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-details">Details</Label>
            <Textarea
              id="project-details"
              value={details}
              disabled={pending}
              onChange={(event) => setDetails(event.target.value)}
            />
          </div>

          {formError ? (
            <p role="alert" className="text-sm text-destructive">
              {formError}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button type="button" variant="outline" disabled={pending} />
            }
          >
            Cancel
          </DialogClose>
          <Button type="button" disabled={pending} onClick={handleSubmit}>
            {pending ? "Saving…" : projectId ? "Save changes" : "Save project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
