import {
  parseTemplateLines,
  parseTemplateMilestones,
  type DocumentTemplate,
  type DocumentTemplateKind,
} from "@/lib/document-templates"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database.types"

const unavailable =
  "Document templates are not available until the document templates migration is applied."

function storageError(error: { message?: string; code?: string } | null): string | null {
  if (!error) return null
  const text = `${error.code ?? ""} ${error.message ?? ""}`
  if (/42P01|PGRST205|schema cache|does not exist|Could not find the table/i.test(text)) {
    return unavailable
  }
  return "Could not load document templates."
}

function toTemplate(row: {
  id: string
  kind: string
  name: string
  project_type: string | null
  scope_text: string
  terms_text: string
  payment_terms: string
  lines: Json
  milestones: Json
  is_active: boolean
}): DocumentTemplate | null {
  if (row.kind !== "quotation" && row.kind !== "work_order") return null
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    projectType: row.project_type ?? "",
    scopeText: row.scope_text,
    termsText: row.terms_text,
    paymentTerms: row.payment_terms,
    lines: parseTemplateLines(row.lines),
    milestones: parseTemplateMilestones(row.milestones),
    isActive: row.is_active,
  }
}

export async function listDocumentTemplates(): Promise<{
  templates: DocumentTemplate[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("document_templates")
    .select(
      "id, kind, name, project_type, scope_text, terms_text, payment_terms, lines, milestones, is_active",
    )
    .order("kind", { ascending: true })
    .order("name", { ascending: true })

  if (error) return { templates: [], error: storageError(error) }
  return {
    templates: (data ?? []).flatMap((row) => {
      const template = toTemplate(row)
      return template ? [template] : []
    }),
    error: null,
  }
}

export async function listActiveDocumentTemplates(
  kind: DocumentTemplateKind,
): Promise<{ templates: DocumentTemplate[]; error: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("document_templates")
    .select(
      "id, kind, name, project_type, scope_text, terms_text, payment_terms, lines, milestones, is_active",
    )
    .eq("kind", kind)
    .eq("is_active", true)
    .order("name", { ascending: true })

  if (error) return { templates: [], error: storageError(error) }
  return {
    templates: (data ?? []).flatMap((row) => {
      const template = toTemplate(row)
      return template ? [template] : []
    }),
    error: null,
  }
}
