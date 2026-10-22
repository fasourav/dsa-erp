"use server"

import { revalidatePath } from "next/cache"

import {
  storedTemplateLines,
  storedTemplateMilestones,
  type DocumentTemplateKind,
} from "@/lib/document-templates"
import { friendlyDbError } from "@/lib/db-errors"
import { isUuid } from "@/lib/ids"
import { denyUnless } from "@/lib/permissions"
import { revalidateSettings } from "@/lib/revalidate-settings"
import {
  documentTemplateNameSchema,
  documentTemplateSchema,
  firstIssue,
  type DocumentTemplateInput,
} from "@/lib/schemas"
import { createClient } from "@/lib/supabase/server"

export type TemplateActionResult = {
  error: string | null
  fieldErrors?: Partial<Record<keyof DocumentTemplateInput, string>>
}

function templateError(error: { message?: string; code?: string }): string {
  const message = error.message ?? ""
  if (/duplicate key|unique/i.test(message)) {
    return "A template with this name already exists for that document kind."
  }
  if (/document_templates_name_len|name_len/i.test(message)) {
    return "Use 120 characters or fewer."
  }
  if (/payload_check|check constraint/i.test(message)) {
    return "Lines need a description, unit, quantity, and rate. Milestone percents must total 100."
  }
  return friendlyDbError(error, "Could not save the document template.")
}

function revalidateTemplates() {
  revalidateSettings("documents")
  revalidatePath("/documents/quotations")
  revalidatePath("/documents/work-orders")
}

export async function saveDocumentTemplate(
  templateId: string | null,
  input: DocumentTemplateInput,
): Promise<TemplateActionResult> {
  const denied = await denyUnless("document_templates", templateId ? "edit" : "add")
  if (denied) return { error: denied }
  if (templateId && !isUuid(templateId)) {
    return { error: "That template could not be found." }
  }

  const parsed = documentTemplateSchema.safeParse(input)
  if (!parsed.success) {
    return {
      error: null,
      fieldErrors: {
        kind: firstIssue(parsed.error, "kind"),
        name: firstIssue(parsed.error, "name"),
        projectType: firstIssue(parsed.error, "projectType"),
        scopeText: firstIssue(parsed.error, "scopeText"),
        termsText: firstIssue(parsed.error, "termsText"),
        paymentTerms: firstIssue(parsed.error, "paymentTerms"),
        lines: firstIssue(parsed.error, "lines"),
        milestones: firstIssue(parsed.error, "milestones"),
        isActive: firstIssue(parsed.error, "isActive"),
      },
    }
  }

  const supabase = await createClient()
  const row = {
    kind: parsed.data.kind,
    name: parsed.data.name,
    project_type: parsed.data.projectType || null,
    scope_text: parsed.data.scopeText.trim(),
    terms_text: parsed.data.termsText.trim(),
    payment_terms: parsed.data.paymentTerms.trim(),
    lines: storedTemplateLines(parsed.data.lines),
    milestones: storedTemplateMilestones(parsed.data.milestones),
    is_active: parsed.data.isActive,
    updated_at: new Date().toISOString(),
  }

  if (templateId) {
    const { error } = await supabase.from("document_templates").update(row).eq("id", templateId)
    if (error) return { error: templateError(error) }
  } else {
    const { error } = await supabase.from("document_templates").insert(row)
    if (error) return { error: templateError(error) }
  }

  revalidateTemplates()
  return { error: null }
}

export async function duplicateDocumentTemplate(
  templateId: string,
  name: string,
): Promise<TemplateActionResult> {
  const denied = await denyUnless("document_templates", "add")
  if (denied) return { error: denied }
  if (!isUuid(templateId)) return { error: "That template could not be found." }

  const parsedName = documentTemplateNameSchema.safeParse(name)
  if (!parsedName.success) {
    return { error: null, fieldErrors: { name: parsedName.error.issues[0]?.message } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("document_templates")
    .select(
      "kind, project_type, scope_text, terms_text, payment_terms, lines, milestones, is_active",
    )
    .eq("id", templateId)
    .maybeSingle()
  if (error) return { error: templateError(error) }
  if (!data) return { error: "That template could not be found." }

  const inserted = await supabase.from("document_templates").insert({
    kind: data.kind,
    name: parsedName.data,
    project_type: data.project_type,
    scope_text: data.scope_text,
    terms_text: data.terms_text,
    payment_terms: data.payment_terms,
    lines: data.lines,
    milestones: data.milestones,
    is_active: data.is_active,
  })
  if (inserted.error) return { error: templateError(inserted.error) }

  revalidateTemplates()
  return { error: null }
}

export async function deleteDocumentTemplate(templateId: string): Promise<TemplateActionResult> {
  const denied = await denyUnless("document_templates", "delete")
  if (denied) return { error: denied }
  if (!isUuid(templateId)) return { error: "That template could not be found." }

  const supabase = await createClient()
  const { error } = await supabase.from("document_templates").delete().eq("id", templateId)
  if (error) return { error: templateError(error) }
  revalidateTemplates()
  return { error: null }
}

export async function saveDocumentAsTemplate(input: {
  kind: DocumentTemplateKind
  name: string
  payload: Omit<DocumentTemplateInput, "kind" | "name" | "isActive" | "projectType"> & {
    projectType?: string
  }
}): Promise<TemplateActionResult> {
  return saveDocumentTemplate(null, {
    kind: input.kind,
    name: input.name,
    projectType: input.payload.projectType ?? "",
    scopeText: input.payload.scopeText,
    termsText: input.payload.termsText,
    paymentTerms: input.payload.paymentTerms,
    lines: input.payload.lines,
    milestones: input.payload.milestones,
    isActive: true,
  })
}
