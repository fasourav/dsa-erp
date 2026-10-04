"use server"

import { revalidatePath } from "next/cache"

import type { ProjectStatus } from "@/lib/project-summary"
import {
  isIsoDate,
  isProjectStatus,
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

  if (!isProjectStatus(input.status)) {
    fieldErrors.status = "Choose a project status."
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

  let savedType = ""
  let savedPhase = ""

  if (id) {
    const { data: existing, error: existingError } = await supabase
      .from("projects")
      .select("project_type, current_phase")
      .eq("id", id)
      .limit(1)

    if (existingError) {
      return { error: "Could not save this project." }
    }

    if (!existing || existing.length === 0) {
      return { error: "That project could not be found." }
    }

    savedType = existing[0].project_type?.trim() ?? ""
    savedPhase = existing[0].current_phase?.trim() ?? ""
  }

  const catalogErrors = await catalogFieldErrors(supabase, {
    projectType,
    savedType,
    phase,
    savedPhase,
  })

  if (catalogErrors === null) {
    return { error: "Could not save this project." }
  }

  if (Object.keys(catalogErrors).length > 0) {
    return { error: null, fieldErrors: catalogErrors }
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

async function catalogFieldErrors(
  supabase: Awaited<ReturnType<typeof createClient>>,
  values: {
    projectType: string
    savedType: string
    phase: string
    savedPhase: string
  },
): Promise<ProjectFormFieldErrors | null> {
  const [typeKnown, phaseKnown] = await Promise.all([
    values.projectType && values.projectType !== values.savedType
      ? catalogHasName(supabase, "project_types", values.projectType)
      : Promise.resolve(true),
    values.phase && values.phase !== values.savedPhase
      ? catalogHasName(supabase, "project_phases", values.phase)
      : Promise.resolve(true),
  ])

  if (typeKnown === null || phaseKnown === null) {
    return null
  }

  const fieldErrors: ProjectFormFieldErrors = {}

  if (!typeKnown) {
    fieldErrors.projectType = "Choose a project type."
  }

  if (!phaseKnown) {
    fieldErrors.phase = "Choose a project phase."
  }

  return fieldErrors
}

async function catalogHasName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "project_types" | "project_phases",
  name: string,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("name", name)
    .limit(1)

  if (error) {
    return null
  }

  return (data?.length ?? 0) > 0
}
