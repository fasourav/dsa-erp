"use server"

import { eqVersion, missedUpdateMessage, staleWriteMessage, withVersion } from "@/lib/record-version"
import { revalidatePath } from "next/cache"

import { friendlyDbError, mentions } from "@/lib/db-errors"
import { phaseProgressPercent } from "@/lib/project-progress"
import type { ProjectStatus } from "@/lib/project-summary"
import { denyUnless } from "@/lib/permissions"
import { firstIssue, projectValueSchema } from "@/lib/schemas"
import {
  isIsoDate,
  isProjectStatus,
  parseProjectValue,
  isFutureIsoDate,
} from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import { cleanUpDeletedAttachmentFiles } from "@/lib/attachment-files"

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ProjectFormInput = {
  version?: string
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
  const denied = await denyUnless("projects", "add")
  if (denied) return { error: denied }
  return saveProject(null, input)
}

export async function updateProject(
  id: string,
  input: ProjectFormInput,
): Promise<ProjectFormResult> {
  const denied = await denyUnless("projects", "edit")
  if (denied) return { error: denied }
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
  } else if (isFutureIsoDate(startedOn)) {
    fieldErrors.startedOn = "Start date can't be in the future."
  }

  if (!isProjectStatus(input.status)) {
    fieldErrors.status = "Choose a project status."
  }

  if (totalValue === null || totalValue <= 0) {
    fieldErrors.totalValue = input.totalValue.trim()
      ? "Enter an amount greater than 0."
      : "Enter a project value."
  }

  const projectCheck = projectValueSchema.safeParse({
    startedOn,
    totalValue: input.totalValue,
  })
  if (!projectCheck.success) {
    const startedIssue = firstIssue(projectCheck.error, "startedOn")
    const valueIssue = firstIssue(projectCheck.error, "totalValue")
    if (startedIssue && !fieldErrors.startedOn) fieldErrors.startedOn = startedIssue
    if (valueIssue && !fieldErrors.totalValue) fieldErrors.totalValue = valueIssue
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

  const [{ data: clientMatches, error: clientLookupError }, { data: phaseRows, error: phasesError }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id")
        .eq("id", clientId)
        .limit(1),
      supabase
        .from("project_phases")
        .select("name, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
    ])

  if (clientLookupError || phasesError) {
    return { error: "Could not save this project." }
  }

  if (!clientMatches || clientMatches.length === 0) {
    return {
      error: null,
      fieldErrors: { clientId: "Choose a client." },
    }
  }

  const progressPercent = phaseProgressPercent(phase, phaseRows ?? [])

  const values = {
    name,
    client_id: clientId,
    location: location || null,
    started_on: startedOn,
    project_type: projectType || null,
    status,
    current_phase: phase || null,
    progress_percent: progressPercent,
    total_value: totalValue ?? 0,
    details: details || null,
  }

  const { data, error } = id
    ? await eqVersion(
        supabase.from("projects").update(withVersion(values, input.version)).eq("id", id),
        input.version,
      ).select("id")
    : await supabase.from("projects").insert(values).select("id")

  if (error) {
    const stale = staleWriteMessage(error)
    if (stale) return { error: stale }

    if (error.code === "23503") {
      return {
        error: null,
        fieldErrors: { clientId: "Choose a client." },
      }
    }

    if (mentions(error, "projects_started_on_launch")) {
      return {
        error: null,
        fieldErrors: { startedOn: "Use a date on or after 01 Jan 2021." },
      }
    }

    if (mentions(error, "cannot be less than invoices")) {
      return {
        error: null,
        fieldErrors: {
          totalValue: "Project value cannot be less than invoices already issued.",
        },
      }
    }

    if (error.code === "23514") {
      return {
        error: null,
        fieldErrors: {
          totalValue: "Enter an amount greater than 0.",
        },
      }
    }

    return { error: friendlyDbError(error, "Could not save this project.") }
  }

  if (!data || data.length === 0) {
    return { error: missedUpdateMessage(id ? input.version : undefined, "That project could not be found.") }
  }

  revalidatePath("/projects")
  revalidatePath("/clients")
  return { error: null }
}

export async function deleteProject(id: string): Promise<DeleteProjectResult> {
  const denied = await denyUnless("projects", "delete")
  if (denied) return { error: denied }
  if (!idPattern.test(id)) {
    return { error: "That project could not be found." }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { error: "You must be signed in." }
  }

  const linked = "This project is linked to other records and cannot be deleted."
  const blocked = await projectDeleteBlock(supabase, id)
  if (blocked) return { error: blocked === "linked" ? linked : "Could not delete this project." }

  const { data, error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return { error: linked }
    }

    return { error: "Could not delete this project." }
  }

  if (!data || data.length === 0) {
    const still = await supabase.from("projects").select("id").eq("id", id).maybeSingle()
    if (still.error) return { error: "Could not delete this project." }
    if (still.data) return { error: linked }
    return { error: "That project could not be found." }
  }

  cleanUpDeletedAttachmentFiles()
  revalidatePath("/projects")
  revalidatePath("/clients")
  return { error: null }
}

async function projectDeleteBlock(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<"linked" | "error" | null> {
  const checks = await Promise.all([
    supabase.from("client_invoices").select("id").eq("project_id", id).limit(1),
    supabase.from("vendor_purchase_orders").select("id").eq("project_id", id).limit(1),
    supabase.from("work_orders").select("id").eq("project_id", id).limit(1),
    supabase.from("quotations").select("id").eq("project_id", id).limit(1),
    supabase.from("vat_tax_payments").select("id").eq("project_id", id).limit(1),
  ])
  if (checks.some((check) => check.error)) return "error"
  if (checks.some((check) => (check.data?.length ?? 0) > 0)) return "linked"
  return null
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
