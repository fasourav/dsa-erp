"use server"

import { revalidatePath } from "next/cache"

import type { ProjectStatus } from "@/lib/project-summary"
import {
  isIsoDate,
  isProjectPhase,
  isProjectStatus,
  isProjectType,
  parseProjectValue,
} from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ProjectFormInput = {
  name: string
  clientId: string
  location: string
  startedOn: string
  projectType: string
  status: ProjectStatus
  phase: string
  totalValue: string
  details: string
}

export type ProjectFormFieldErrors = {
  name?: string
  clientId?: string
  startedOn?: string
  projectType?: string
  status?: string
  phase?: string
  totalValue?: string
}

export type ProjectFormResult = {
  error: string | null
  fieldErrors?: ProjectFormFieldErrors
}

export type DeleteProjectResult = {
  error: string | null
}

export async function addProject(
  input: ProjectFormInput,
): Promise<ProjectFormResult> {
  return saveProject(null, input)
}

export async function updateProject(
  id: string,
  input: ProjectFormInput,
): Promise<ProjectFormResult> {
  if (!idPattern.test(id)) {
    return { error: "That project could not be found." }
  }

  return saveProject(id, input)
}

async function saveProject(
  id: string | null,
  input: ProjectFormInput,
): Promise<ProjectFormResult> {
  const name = input.name.trim()
  const clientId = input.clientId.trim()
  const location = input.location.trim()
  const startedOn = input.startedOn.trim()
  const projectType = input.projectType.trim()
  const phase = input.phase.trim()
  const details = input.details.trim()
  const totalValue = parseProjectValue(input.totalValue)
  const fieldErrors: ProjectFormFieldErrors = {}

  if (!name) {
    fieldErrors.name = "Enter the project name."
  }

  if (!idPattern.test(clientId)) {
    fieldErrors.clientId = "Choose a client."
  }

  if (!isIsoDate(startedOn)) {
    fieldErrors.startedOn = "Enter a start date."
  }

  if (projectType && !isProjectType(projectType)) {
    fieldErrors.projectType = "Choose a project type."
  }

  if (!isProjectStatus(input.status)) {
    fieldErrors.status = "Choose a project status."
  }

  if (phase && !isProjectPhase(phase)) {
    fieldErrors.phase = "Choose a project phase."
  }

  if (totalValue === null) {
    fieldErrors.totalValue = input.totalValue.trim()
      ? "Enter a project value of 0 or more."
      : "Enter a project value."
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const status: ProjectStatus = input.status
  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data: clientMatches, error: clientLookupError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .limit(1)

  if (clientLookupError) {
    return { error: "Could not save this project." }
  }

  if (!clientMatches || clientMatches.length === 0) {
    return {
      error: null,
      fieldErrors: { clientId: "Choose a client." },
    }
  }

  const values = {
    name,
    client_id: clientId,
    location: location || null,
    started_on: startedOn,
    project_type: projectType || null,
    status,
    current_phase: phase || null,
    total_value: totalValue ?? 0,
    details: details || null,
  }

  const { data, error } = id
    ? await supabase.from("projects").update(values).eq("id", id).select("id")
    : await supabase.from("projects").insert(values).select("id")

  if (error) {
    if (error.code === "23503") {
      return {
        error: null,
        fieldErrors: { clientId: "Choose a client." },
      }
    }

    if (error.code === "23514") {
      return {
        error: null,
        fieldErrors: {
          totalValue: "Enter a project value of 0 or more.",
        },
      }
    }

    return { error: "Could not save this project." }
  }

  if (!data || data.length === 0) {
    return { error: "That project could not be found." }
  }

  revalidatePath("/projects")
  revalidatePath("/clients")
  return { error: null }
}

export async function deleteProject(id: string): Promise<DeleteProjectResult> {
  if (!idPattern.test(id)) {
    return { error: "That project could not be found." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return {
        error: "This project is linked to other records and cannot be deleted.",
      }
    }

    return { error: "Could not delete this project." }
  }

  if (!data || data.length === 0) {
    return { error: "That project could not be found." }
  }

  revalidatePath("/projects")
  revalidatePath("/clients")
  return { error: null }
}
