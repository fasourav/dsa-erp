"use server"

import { revalidatePath } from "next/cache"

import { isUuid } from "@/lib/ids"
import { parseProjectValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"

export type LeadInput = {
  leadName: string
  kind: string
  phone: string
  email: string
  projectName: string
  projectType: string
  source: string
  estimatedValue: string
  currentStage: string
  status: string
  probability: string
  notes: string
}

export type LeadFieldErrors = {
  leadName?: string
  kind?: string
  status?: string
}

export type LeadResult = {
  error: string | null
  fieldErrors?: LeadFieldErrors
}

export type DeleteResult = {
  error: string | null
}

export type ConvertResult = {
  error: string | null
  clientId?: string
  projectId?: string
}

const validKinds = ["person", "company"]

export async function addLead(input: LeadInput): Promise<LeadResult> {
  return saveLead(null, input)
}

export async function updateLead(
  id: string,
  input: LeadInput,
): Promise<LeadResult> {
  if (!isUuid(id)) return { error: "That lead could not be found." }
  return saveLead(id, input)
}

export async function deleteLead(id: string): Promise<DeleteResult> {
  if (!isUuid(id)) return { error: "That lead could not be found." }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const { data, error } = await supabase
    .from("leads")
    .delete()
    .eq("id", id)
    .select("id")

  if (error) {
    if (error.code === "23503" || /foreign key/i.test(error.message)) {
      return {
        error:
          "This lead is linked to other records and cannot be deleted.",
      }
    }
    return { error: "Could not delete this lead." }
  }
  if (!data || data.length === 0)
    return { error: "That lead could not be found." }

  revalidatePath("/leads")
  return { error: null }
}

export async function convertLead(leadId: string): Promise<ConvertResult> {
  if (!isUuid(leadId)) return { error: "That lead could not be found." }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const { data: leadData, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .limit(1)

  if (leadErr || !leadData || leadData.length === 0) {
    return { error: "That lead could not be found." }
  }

  const lead = leadData[0]

  if (lead.converted_client_id || lead.converted_project_id) {
    return { error: "This lead has already been converted." }
  }

  const clientValues = {
    kind: lead.kind,
    person_name: lead.kind === "person" ? lead.lead_name : null,
    company_name: lead.kind === "company" ? lead.lead_name : null,
    phone: lead.phone || null,
    email: lead.email || null,
    notes: lead.notes || null,
  }

  const { data: clientData, error: clientErr } = await supabase
    .from("clients")
    .insert(clientValues)
    .select("id")

  if (clientErr || !clientData || clientData.length === 0) {
    return { error: "Could not create a client from this lead." }
  }

  const clientId = clientData[0].id

  const projectName =
    (typeof lead.project_name === "string" && lead.project_name.trim()) ||
    lead.lead_name

  const projectValues = {
    name: projectName,
    client_id: clientId,
    project_type: lead.project_type || null,
    total_value: lead.estimated_value ?? 0,
    started_on: new Date().toISOString().slice(0, 10),
    status: "active" as const,
    lead_id: leadId,
  }

  const { data: projectData, error: projectErr } = await supabase
    .from("projects")
    .insert(projectValues)
    .select("id")

  if (projectErr || !projectData || projectData.length === 0) {
    return { error: "Client created, but could not create a project." }
  }

  const projectId = projectData[0].id

  await supabase
    .from("leads")
    .update({
      status: "won",
      converted_client_id: clientId,
      converted_project_id: projectId,
    })
    .eq("id", leadId)

  revalidatePath("/leads")
  revalidatePath("/clients")
  revalidatePath("/projects")
  return { error: null, clientId, projectId }
}

async function saveLead(
  id: string | null,
  input: LeadInput,
): Promise<LeadResult> {
  const leadName = input.leadName.trim()
  const kind = input.kind.trim()
  const phone = input.phone.trim()
  const email = input.email.trim()
  const projectName = input.projectName.trim()
  const projectType = input.projectType.trim()
  const source = input.source.trim()
  const currentStage = input.currentStage.trim()
  const status = input.status.trim()
  const notes = input.notes.trim()
  const estimatedValue = parseProjectValue(input.estimatedValue)
  const probability = parseProjectValue(input.probability)
  const fieldErrors: LeadFieldErrors = {}

  if (!leadName) fieldErrors.leadName = "Enter the lead name."
  if (!validKinds.includes(kind)) fieldErrors.kind = "Choose Person or Company."

  if (Object.keys(fieldErrors).length > 0) {
    return { error: null, fieldErrors }
  }

  const supabase = await createClient()
  const { data: auth, error: authErr } = await supabase.auth.getUser()
  if (authErr || !auth.user) return { error: "You must be signed in." }

  const { data: statusRows, error: statusErr } = await supabase
    .from("lead_statuses")
    .select("code")

  if (statusErr) return { error: "Could not save this lead." }

  const allowedStatuses = new Set(
    (statusRows ?? []).map((row) => String(row.code)),
  )

  if (!allowedStatuses.has(status)) {
    return { error: null, fieldErrors: { status: "Choose a status." } }
  }

  const values = {
    lead_name: leadName,
    kind: kind as "person" | "company",
    phone: phone || null,
    email: email || null,
    project_name: projectName || null,
    project_type: projectType || null,
    source: source || null,
    estimated_value: estimatedValue,
    current_stage: currentStage || null,
    status,
    probability: probability,
    notes: notes || null,
  }

  const { data, error } = id
    ? await supabase.from("leads").update(values).eq("id", id).select("id")
    : await supabase.from("leads").insert(values).select("id")

  if (error) return { error: "Could not save this lead." }
  if (!data || data.length === 0)
    return { error: "That lead could not be found." }

  revalidatePath("/leads")
  return { error: null }
}
