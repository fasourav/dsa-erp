"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { saveQuotation } from "@/app/(app)/documents/actions"
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

export function QuotationStudio({
  draft,
  clients,
  projects,
  employees,
  origin,
  margins,
}: {
  draft: QuotationDraft
  clients: NamedOption[]
  projects: ProjectChoice[]
  employees: EmployeeChoice[]
  origin: string
  margins: PrintMargins
}) {
  const router = useRouter()
  const [form, setForm] = useState(draft)
  const [error, setError] = useState<string | null>(null)
  const [pending, startSave] = useTransition()
  const canSave = useCan("quotations", form.id ? "edit" : "add")
  const client = clients.find((item) => item.id === form.clientId)
  const clientProjects = projects.filter((project) => project.clientId === form.clientId)
  const project = clientProjects.find((item) => item.id === form.projectId)
  const preview = presentQuotation({
        documentNo: form.documentNo,
        issuedOn: form.issuedOn,
        validUntil: form.validUntil,
        verifyUrl: verifyUrl(origin, form.verifyToken),
        preparedForName: client?.personName || client?.name || "",
        preparedForDetail: client?.detail || "",
        clientName: customerDisplayName(client),
        projectName: project?.name || "",
        area: form.area,
        subject: form.subject,
        aitPercent: form.aitPercent,
        lines: form.lines,
        milestones: form.milestones,
        terms: form.terms,
        exclusions: form.exclusions,
        preparedBy: form.preparedBy,
        preparedByRole: roleFor(employees, form.preparedBy),
        authorizedBy: form.authorizedBy,
        authorizedByRole: roleFor(employees, form.authorizedBy),
      })

  return (
    <DocumentWorkspace
      title="Quotation"
      description="Prints the quotation only. The letterhead and footer stay on the pad."
      margins={margins}
      preview={preview}
      canSave={canSave}
      pending={pending}
      error={error}
      files={{ parentType: "quotation", parentId: form.id }}
      onSave={() => {
        setError(null)
        startSave(async () => {
          const result = await saveQuotation(form)
          if (result.error || !result.id) {
            setError(result.error ?? "Could not save this quotation.")
            return
          }
          setForm((current) => ({
            ...current,
            id: result.id ?? current.id,
            documentNo: result.documentNo ?? current.documentNo,
            verifyToken: result.verifyToken ?? current.verifyToken,
          }))
          if (!form.id) router.replace(`/documents/quotations/${result.id}`)
        })
      }}
    >
      <ChoiceField
        id="client"
        label="Client Name"
        value={form.clientId}
        disabled={!canSave}
        options={clients.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(clientId) => setForm({ ...form, clientId, projectId: "" })}
      />
      <ChoiceField
        id="project"
        label="Project Name"
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
        id="authorized-by"
        label="Authorized By"
        value={form.authorizedBy}
        employees={employees}
        disabled={!canSave}
        onChange={(authorizedBy) => setForm({ ...form, authorizedBy })}
      />
    </DocumentWorkspace>
  )
}
