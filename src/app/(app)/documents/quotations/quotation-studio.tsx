"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { saveQuotation, trashSavedDocument } from "@/app/(app)/documents/actions"
import { saveDocumentAsTemplate } from "@/app/(app)/settings/document-template-actions"
import { useCan } from "@/components/access-provider"
import {
  AreaField,
  ChoiceField,
  EmployeeField,
  LineEditor,
  MilestoneEditor,
  ReadOnlyField,
  TextField,
} from "@/components/documents/document-fields"
import { DocumentWorkspace } from "@/components/documents/document-workspace"
import { SignatureStampPanel, type StampChange } from "@/components/documents/signature-stamp-panel"
import type { QuotationDraft } from "@/lib/documents/queries"
import {
  customerDisplayName,
  quotationStatuses,
  roleFor,
  type EmployeeChoice,
  type NamedOption,
  type PrintMargins,
  type ProjectChoice,
} from "@/lib/documents/drafts"
import { verifyUrl } from "@/lib/documents/verify-url"
import { presentQuotation } from "@/lib/documents/present"
import { reconcileStamps } from "@/lib/documents/signature-stamps"
import { attachSignatureUrls } from "@/lib/documents/signature-urls"
import {
  draftLinesFromTemplate,
  draftMilestonesFromTemplate,
  joinedTerms,
  templateLinesFromDraft,
  templateMilestonesFromDraft,
  type DocumentTemplate,
} from "@/lib/document-templates"
import { savedToast } from "@/lib/saved"

export function QuotationStudio({
  draft,
  clients,
  projects,
  employees,
  origin,
  margins,
  templates,
  leads = [],
  signatureUrls,
}: {
  draft: QuotationDraft
  clients: NamedOption[]
  projects: ProjectChoice[]
  employees: EmployeeChoice[]
  origin: string
  margins: PrintMargins
  templates: DocumentTemplate[]
  leads?: NamedOption[]
  signatureUrls: Record<string, string>
}) {
  const router = useRouter()
  const [form, setForm] = useState(draft)
  const [savedMark, setSavedMark] = useState(() => JSON.stringify(draft))
  const [urls, setUrls] = useState(signatureUrls)
  const [error, setError] = useState<string | null>(null)
  const [pending, startSave] = useTransition()
  const canSave = useCan("quotations", form.id ? "edit" : "add")
  const canStartFromTemplate = useCan("quotations", "add")
  const canManageTemplates = useCan("document_templates", "add")
  const canSaveAsTemplate = Boolean(form.id) && canManageTemplates
  const client = clients.find((item) => item.id === form.clientId)
  const lead = leads.find((item) => item.id === form.leadId)
  const clientProjects = projects.filter((project) => project.clientId === form.clientId)
  const project = projects.find((item) => item.id === form.projectId)
  const partyName = client ? customerDisplayName(client) : lead?.name || ""
  const preview = presentQuotation({
        documentNo: form.documentNo,
        issuedOn: form.issuedOn,
        validUntil: form.validUntil,
        verifyUrl: verifyUrl(origin, form.verifyToken),
        preparedForName: client?.personName || client?.name || lead?.name || "",
        preparedForDetail: client?.detail || lead?.detail || "",
        clientName: partyName,
        projectName: project?.name || lead?.companyName || "",
        area: form.area,
        subject: form.subject,
        aitPercent: form.aitPercent,
        lines: form.lines,
        milestones: form.milestones,
        terms: form.terms,
        exclusions: form.exclusions,
        subtitle: form.subtitle,
        preparedBy: form.preparedBy,
        preparedByRole: roleFor(employees, form.preparedBy),
        checkedBy: form.checkedBy,
        checkedByRole: roleFor(employees, form.checkedBy),
        authorizedBy: form.authorizedBy,
        authorizedByRole: roleFor(employees, form.authorizedBy),
        stamps: form.signatureStamps,
      })
  const unsaved = JSON.stringify(form) !== savedMark
  const slotField = { prepared: "preparedBy", checked: "checkedBy", authorized: "authorizedBy" } as const
  function applyStamp(change: StampChange) {
    const next = { ...form, [slotField[change.slot]]: change.name, signatureStamps: change.stamps }
    setForm(next)
    setSavedMark(JSON.stringify(next))
    const path = change.stamps[change.slot]?.imagePath
    if (path && change.imageUrl) setUrls((current) => ({ ...current, [path]: change.imageUrl! }))
  }

  return (
    <DocumentWorkspace
      title="Quotation"
      description="Prints the quotation only. The letterhead and footer stay on the pad."
      margins={margins}
      source={attachSignatureUrls({ kind: "print", doc: preview }, urls)}
      record={form.id ? { kind: "quotation", id: form.id } : null}
      canSave={canSave}
      canTrash={Boolean(form.id)}
      trashName={form.documentNo || "This quotation"}
      onTrash={async () => {
        if (!form.id) return "Save the quotation before deleting it."
        const result = await trashSavedDocument({ kind: "quotation", id: form.id })
        if (result.error) return result.error
        savedToast("Moved To Trash.")
        router.push("/documents/quotations")
        return null
      }}
      pending={pending}
      error={error}
      dirty={unsaved}
      files={{ parentType: "quotation", parentId: form.id }}
      templateNames={templates.map((item) => item.name)}
      canStartFromTemplate={canStartFromTemplate}
      onPickTemplate={(name) => {
        const template = templates.find((item) => item.name === name)
        if (!template) return
        setForm((current) => ({
          ...current,
          subject: template.scopeText,
          terms: joinedTerms(template.termsText, template.paymentTerms),
          lines: draftLinesFromTemplate(template.lines),
          milestones: draftMilestonesFromTemplate(template.milestones),
        }))
      }}
      canSaveAsTemplate={canSaveAsTemplate}
      onSaveAsTemplate={async (name) => {
        const result = await saveDocumentAsTemplate({
          kind: "quotation",
          name,
          payload: {
            scopeText: form.subject,
            termsText: form.terms,
            paymentTerms: "",
            lines: templateLinesFromDraft(form.lines),
            milestones: templateMilestonesFromDraft(form.milestones),
          },
        })
        if (result.fieldErrors?.name) return result.fieldErrors.name
        if (result.fieldErrors?.lines) return result.fieldErrors.lines
        if (result.fieldErrors?.milestones) return result.fieldErrors.milestones
        if (result.error) return result.error
        savedToast("Saved As Template.")
        return null
      }}
      onSave={() => {
        setError(null)
        startSave(async () => {
          const result = await saveQuotation(form)
          if (result.error || !result.id) {
            setError(result.error ?? "Could not save this quotation.")
            return
          }
          const signatureStamps = reconcileStamps(form.signatureStamps, {
            prepared: form.preparedBy,
            checked: form.checkedBy,
            authorized: form.authorizedBy,
          })
          const saved = {
            ...form,
            signatureStamps,
            id: result.id ?? form.id,
            documentNo: result.documentNo ?? form.documentNo,
            verifyToken: result.verifyToken ?? form.verifyToken,
            version: result.version ?? form.version,
          }
          setSavedMark(JSON.stringify(saved))
          setForm((current) => ({
            ...current,
            signatureStamps,
            id: result.id ?? current.id,
            documentNo: result.documentNo ?? current.documentNo,
            verifyToken: result.verifyToken ?? current.verifyToken,
            version: result.version ?? current.version,
          }))
          if (!form.id) router.replace(`/documents/quotations/${result.id}`)
        })
      }}
    >
      <ChoiceField
        id="client"
        label="Client Name"
        searchable
        value={form.clientId}
        disabled={!canSave}
        options={clients.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(clientId) => setForm({ ...form, clientId, projectId: "" })}
      />
      <ChoiceField
        id="lead"
        label="Lead"
        searchable
        value={form.leadId}
        disabled={!canSave}
        options={leads.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(leadId) => setForm({ ...form, leadId })}
      />
      <ChoiceField
        id="project"
        label="Project Name"
        searchable
        value={form.projectId}
        disabled={!canSave || !form.clientId}
        options={clientProjects.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(projectId) => setForm({ ...form, projectId })}
      />
      <ReadOnlyField label="Customer Name" value={customerDisplayName(client)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          id="issued-on"
          label="Date"
          type="date"
          value={form.issuedOn}
          disabled={!canSave}
          onChange={(issuedOn) => setForm({ ...form, issuedOn })}
        />
        <TextField
          id="valid-until"
          label="Valid Until"
          type="date"
          value={form.validUntil}
          disabled={!canSave}
          onChange={(validUntil) => setForm({ ...form, validUntil })}
        />
      </div>
      <ChoiceField
        id="status"
        label="Status"
        value={form.status}
        disabled={!canSave}
        options={quotationStatuses.map((status) => ({ value: status.value, label: status.label }))}
        onChange={(status) => setForm({ ...form, status })}
      />
      <TextField
        id="subtitle"
        label="Subtitle"
        value={form.subtitle}
        disabled={!canSave}
        onChange={(subtitle) => setForm({ ...form, subtitle })}
      />
      <TextField
        id="area"
        label="Area"
        value={form.area}
        disabled={!canSave}
        onChange={(area) => setForm({ ...form, area })}
      />
      <AreaField
        id="subject"
        label="Subject"
        value={form.subject}
        disabled={!canSave}
        onChange={(subject) => setForm({ ...form, subject })}
      />
      <TextField
        id="ait"
        label="AIT Percent"
        value={form.aitPercent}
        disabled={!canSave}
        onChange={(aitPercent) => setForm({ ...form, aitPercent })}
      />
      <LineEditor
        lines={form.lines}
        disabled={!canSave}
        onChange={(lines) => setForm({ ...form, lines })}
      />
      <MilestoneEditor
        milestones={form.milestones}
        disabled={!canSave}
        onChange={(milestones) => setForm({ ...form, milestones })}
      />
      <AreaField
        id="terms"
        label="Terms & Conditions"
        value={form.terms}
        disabled={!canSave}
        onChange={(terms) => setForm({ ...form, terms })}
      />
      <AreaField
        id="exclusions"
        label="Exclusions"
        value={form.exclusions}
        disabled={!canSave}
        onChange={(exclusions) => setForm({ ...form, exclusions })}
      />
      <EmployeeField
        id="prepared-by"
        label="Prepared By"
        value={form.preparedBy}
        employees={employees}
        disabled={!canSave}
        onChange={(preparedBy) => setForm({ ...form, preparedBy })}
      />
      <EmployeeField
        id="checked-by"
        label="Checked By"
        value={form.checkedBy}
        employees={employees}
        disabled={!canSave}
        onChange={(checkedBy) => setForm({ ...form, checkedBy })}
      />
      <EmployeeField
        id="authorized-by"
        label="Authorized By"
        value={form.authorizedBy}
        employees={employees}
        disabled={!canSave}
        onChange={(authorizedBy) => setForm({ ...form, authorizedBy })}
      />
      <SignatureStampPanel
        kind="quotation"
        id={form.id}
        stamps={form.signatureStamps}
        names={{ prepared: form.preparedBy, checked: form.checkedBy, authorized: form.authorizedBy }}
        blockedReason={!form.id ? "Save the document before signing." : unsaved ? "Save your changes before signing." : null}
        onChange={applyStamp}
      />
    </DocumentWorkspace>
  )
}
