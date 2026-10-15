"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { saveWorkOrder } from "@/app/(app)/documents/actions"
import { saveDocumentAsTemplate } from "@/app/(app)/settings/document-template-actions"
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
import {
  draftLinesFromTemplate,
  draftMilestonesFromTemplate,
  joinedTerms,
  templateLinesFromDraft,
  templateMilestonesFromDraft,
  type DocumentTemplate,
} from "@/lib/document-templates"
import { savedToast } from "@/lib/saved"
import type { PurchaseOrderChoice, WorkOrderDraft } from "@/lib/documents/queries"

/** Links the purchase order: vendor and project follow it; items and amount are pre-filled only when still empty. */
function withPurchaseOrder(form: WorkOrderDraft, order: PurchaseOrderChoice | undefined): WorkOrderDraft {
  if (!order) return { ...form, purchaseOrderId: "" }
  const blank = !form.lines.some((line) => line.item.trim() || line.unitPrice.trim())
  return {
    ...form,
    purchaseOrderId: order.id,
    vendorId: order.vendorId,
    projectId: order.projectId,
    subject: form.subject || (order.workType ? `Work order for ${order.workType}` : form.subject),
    lines: blank
      ? [
          {
            section: "",
            item: order.workType || "Work as per purchase order",
            specification: order.notes,
            quantity: "1",
            unit: "Job",
            unitPrice: order.totalValue > 0 ? String(order.totalValue) : "",
          },
        ]
      : form.lines,
  }
}

export function WorkOrderStudio({
  draft,
  vendors,
  projects,
  employees,
  purchaseOrders,
  origin,
  margins,
  templates,
}: {
  draft: WorkOrderDraft
  purchaseOrders: PurchaseOrderChoice[]
  vendors: NamedOption[]
  projects: ProjectChoice[]
  employees: EmployeeChoice[]
  origin: string
  margins: PrintMargins
  templates: DocumentTemplate[]
}) {
  const router = useRouter()
  const [form, setForm] = useState(() =>
    draft.purchaseOrderId && !draft.id
      ? withPurchaseOrder(draft, purchaseOrders.find((item) => item.id === draft.purchaseOrderId))
      : draft,
  )
  // The PO link as last saved. Once saved with a PO, the link can switch but never be cleared.
  const [savedPurchaseOrderId, setSavedPurchaseOrderId] = useState(() => (draft.id ? draft.purchaseOrderId : ""))
  const linked = Boolean(form.purchaseOrderId || savedPurchaseOrderId)
  const [error, setError] = useState<string | null>(null)
  const [pending, startSave] = useTransition()
  const canSave = useCan("work_orders", form.id ? "edit" : "add")
  const canStartFromTemplate = useCan("work_orders", "add")
  const canManageTemplates = useCan("document_templates", "add")
  const canSaveAsTemplate = Boolean(form.id) && canManageTemplates
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
      description="Printable work order for a purchase order. The letterhead and footer stay on the pad."
      margins={margins}
      preview={preview}
      canSave={canSave}
      canShare={canSave}
      pending={pending}
      error={error}
      files={{ parentType: "work_order", parentId: form.id }}
      templateNames={templates.map((item) => item.name)}
      canStartFromTemplate={canStartFromTemplate}
      onPickTemplate={(name) => {
        const template = templates.find((item) => item.name === name)
        if (!template) return
        setForm((current) => ({
          ...current,
          introduction: template.scopeText,
          terms: joinedTerms(template.termsText, template.paymentTerms),
          lines: draftLinesFromTemplate(template.lines),
          milestones: draftMilestonesFromTemplate(template.milestones),
        }))
      }}
      canSaveAsTemplate={canSaveAsTemplate}
      onSaveAsTemplate={async (name) => {
        const result = await saveDocumentAsTemplate({
          kind: "work_order",
          name,
          payload: {
            scopeText: form.introduction,
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
        if (!form.id && !form.purchaseOrderId) {
          setError("Choose a purchase order.")
          return
        }
        startSave(async () => {
          const result = await saveWorkOrder(form)
          if (result.error || !result.id) {
            setError(result.error ?? "Could not save this work order.")
            return
          }
          setSavedPurchaseOrderId(form.purchaseOrderId)
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
        id="purchase-order"
        label="Purchase Order"
        placeholder={form.id && !linked ? "No purchase order (older work order)" : "Choose a purchase order"}
        value={form.purchaseOrderId}
        disabled={!canSave}
        options={purchaseOrders.map((item) => ({ value: item.id, label: item.label }))}
        onChange={(purchaseOrderId) => {
          // A work order is the printable form of its PO: it can switch PO but never silently lose it.
          if (!purchaseOrderId && (!form.id || savedPurchaseOrderId)) {
            setError("Choose a purchase order. A work order can't be saved without one.")
            return
          }
          setError(null)
          setForm(withPurchaseOrder(form, purchaseOrders.find((item) => item.id === purchaseOrderId)))
        }}
      />
      <ChoiceField
        id="vendor"
        label="Vendor Name"
        value={form.vendorId}
        disabled={!canSave || linked}
        options={vendors.map((item) => ({ value: item.id, label: item.name }))}
        onChange={(vendorId) => setForm({ ...form, vendorId })}
      />
      <ChoiceField
        id="project"
        label="Project Name"
        value={form.projectId}
        disabled={!canSave || linked}
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
