"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { saveWorkOrder } from "@/app/(app)/documents/actions"
import { useCan } from "@/components/access-provider"
import {
  AreaField,
  ChoiceField,
  EmployeeField,
  LineEditor,
  MilestoneEditor,
  TextField,
} from "@/components/documents/document-fields"
import { DocumentWorkspace } from "@/components/documents/document-workspace"
import {
  roleFor,
  workOrderStatuses,
  type EmployeeChoice,
  type NamedOption,
  type PrintMargins,
  type ProjectChoice,
} from "@/lib/documents/drafts"
import { verifyUrl } from "@/lib/documents/verify-url"
import { presentWorkOrder } from "@/lib/documents/present"
import type { WorkOrderDraft } from "@/lib/documents/queries"

export function WorkOrderStudio({
  draft,
  vendors,
  projects,
  employees,
  origin,
  margins,
}: {
  draft: WorkOrderDraft
  vendors: NamedOption[]
  projects: ProjectChoice[]
  employees: EmployeeChoice[]
  origin: string
  margins: PrintMargins
}) {
  const router = useRouter()
  const [form, setForm] = useState(draft)
  const [error, setError] = useState<string | null>(null)
  const [pending, startSave] = useTransition()
  const canSave = useCan("work_orders", form.id ? "edit" : "add")
  const vendor = vendors.find((item) => item.id === form.vendorId)
  const project = projects.find((item) => item.id === form.projectId)
  const preview = useMemo(
    () =>
      presentWorkOrder({
        documentNo: form.documentNo,
        issuedOn: form.issuedOn,
        verifyUrl: verifyUrl(origin, form.verifyToken),
        vendorName: vendor?.name || "",
        vendorDetail: vendor?.detail || "",
        projectName: project?.name || "",
        proposalOn: form.proposalOn,
        workStart: form.workStart,
        workEnd: form.workEnd,
        subject: form.subject,
        introduction: form.introduction,
        lines: form.lines,
        milestones: form.milestones,
        terms: form.terms,
        preparedBy: form.preparedBy,
        preparedByRole: roleFor(employees, form.preparedBy),
        authorizedBy: form.authorizedBy,
        authorizedByRole: roleFor(employees, form.authorizedBy),
      }),
    [employees, form, origin, project, vendor],
  )

  return (
    <DocumentWorkspace
      title="Work Order"
      description="Prints the work order only. The letterhead and footer stay on the pad."
      margins={margins}
      preview={preview}
      canSave={canSave}
      canShare={canSave}
      pending={pending}
      error={error}
      files={{ parentType: "work_order", parentId: form.id }}
      onSave={() => {
        setError(null)
        startSave(async () => {
          const result = await saveWorkOrder(form)
          if (result.error || !result.id) {
            setError(result.error ?? "Could not save this work order.")
            return
          }
          setForm((current) => ({
            ...current,
            id: result.id ?? current.id,
            documentNo: result.documentNo ?? current.documentNo,
            verifyToken: result.verifyToken ?? current.verifyToken,
            version: result.version ?? current.version,
          }))
          if (!form.id) router.replace(`/documents/work-orders/${result.id}`)
        })
      }}
    >
      <ChoiceField
        id="vendor"
        label="Vendor Name"
        value={form.vendorId}
        disabled={!canSave}
        options={vendors.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(vendorId) => setForm({ ...form, vendorId })}
      />
      <ChoiceField
        id="project"
        label="Project Name"
        value={form.projectId}
        disabled={!canSave}
        options={projects.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(projectId) => setForm({ ...form, projectId })}
      />
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
          id="proposal-on"
          label="Proposal Date"
          type="date"
          value={form.proposalOn}
          disabled={!canSave}
          onChange={(proposalOn) => setForm({ ...form, proposalOn })}
        />
        <TextField
          id="work-start"
          label="Work Start"
          type="date"
          value={form.workStart}
          disabled={!canSave}
          onChange={(workStart) => setForm({ ...form, workStart })}
        />
        <TextField
          id="work-end"
          label="Work End"
          type="date"
          value={form.workEnd}
          disabled={!canSave}
          onChange={(workEnd) => setForm({ ...form, workEnd })}
        />
      </div>
      <ChoiceField
        id="status"
        label="Status"
        value={form.status}
        disabled={!canSave}
        options={workOrderStatuses.map((status) => ({ value: status.value, label: status.label }))}
        onChange={(status) => setForm({ ...form, status })}
      />
      <TextField
        id="subject"
        label="Subject"
        value={form.subject}
        disabled={!canSave}
        onChange={(subject) => setForm({ ...form, subject })}
      />
      <AreaField
        id="introduction"
        label="Introduction"
        value={form.introduction}
        disabled={!canSave}
        onChange={(introduction) => setForm({ ...form, introduction })}
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
