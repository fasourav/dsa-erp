"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2 } from "lucide-react"

import { trashSavedDocument } from "@/app/(app)/documents/actions"
import { saveFormDocument } from "@/app/(app)/documents/forms/actions"
import {
  AreaField,
  ChoiceField,
  EmployeeField,
  ReadOnlyField,
  TextField,
} from "@/components/documents/document-fields"
import { DocumentWorkspace } from "@/components/documents/document-workspace"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  isSignatureEnabled,
  SIGNATURE_OFF,
  type EmployeeChoice,
  type NamedOption,
  type PrintMargins,
  type ProjectChoice,
} from "@/lib/documents/drafts"
import {
  formTitle,
  formToModel,
  lockedMoneyLabel,
  slugForKind,
  type ChallanRow,
  type FormDraft,
  type NoteRow,
  type RfqRow,
  type TextRow,
} from "@/lib/documents/form-model"
import { savedToast } from "@/lib/saved"

function applyRfqVendor(current: FormDraft, vendorId: string, vendors: NamedOption[]): FormDraft {
  const vendor = vendors.find((item) => item.id === vendorId)
  if (!vendor) {
    return { ...current, vendorId: "" }
  }
  const toName = vendor.personName || vendor.companyName || vendor.name
  const detailLines = vendor.detail
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== toName)
  return {
    ...current,
    vendorId,
    body: {
      ...current.body,
      partyName: toName,
      companyName: vendor.companyName || vendor.name,
      partyDetail: detailLines.join("\n"),
    },
  }
}

function applyRfqProject(current: FormDraft, projectId: string, projects: ProjectChoice[]): FormDraft {
  const project = projects.find((item) => item.id === projectId)
  return {
    ...current,
    projectId,
    body: {
      ...current.body,
      projectName: project?.name ?? "",
    },
  }
}

export function FormStudio({
  draft,
  employees,
  vendors = [],
  projects = [],
  origin,
  margins,
  canSave,
}: {
  draft: FormDraft
  employees: EmployeeChoice[]
  vendors?: NamedOption[]
  projects?: ProjectChoice[]
  origin: string
  margins: PrintMargins
  canSave: boolean
}) {
  const router = useRouter()
  const [form, setForm] = useState(draft)
  const [savedMark, setSavedMark] = useState(() => JSON.stringify(draft))
  const [error, setError] = useState<string | null>(null)
  const [pending, startSave] = useTransition()
  const source = useMemo(() => formToModel(form, origin, employees), [employees, form, origin])
  const body = form.body
  const setBody = (patch: Partial<typeof body>) => setForm({ ...form, body: { ...body, ...patch } })

  return (
    <DocumentWorkspace
      title={formTitle(form.kind)}
      description=""
      margins={margins}
      source={source}
      record={form.id ? { kind: form.kind, id: form.id } : null}
      canSave={canSave}
      canTrash={Boolean(form.id)}
      trashName={form.documentNo || formTitle(form.kind)}
      onTrash={
        form.id
          ? async () => {
              const result = await trashSavedDocument({ kind: form.kind, id: form.id ?? "" })
              if (result.error) return result.error
              savedToast("Moved To Trash.")
              router.push(`/documents/${slugForKind(form.kind)}`)
              return null
            }
          : undefined
      }
      pending={pending}
      error={error}
      dirty={JSON.stringify(form) !== savedMark}
      onSave={() => {
        setError(null)
        startSave(async () => {
          const result = await saveFormDocument(form)
          if (result.error) {
            setError(result.error)
            return
          }
          const saved = {
            ...form,
            id: result.id ?? form.id,
            documentNo: result.documentNo ?? form.documentNo,
            verifyToken: result.verifyToken ?? form.verifyToken,
          }
          setSavedMark(JSON.stringify(saved))
          setForm((current) => ({
            ...current,
            id: result.id ?? current.id,
            documentNo: result.documentNo ?? current.documentNo,
            verifyToken: result.verifyToken ?? current.verifyToken,
          }))
          if (!form.id && result.id) router.replace(`/documents/${slugForKind(form.kind)}/${result.id}`)
          savedToast("Saved.")
        })
      }}
    >
      {form.kind === "rfq" ? (
        <>
          <ChoiceField
            id="rfq-vendor"
            label="Vendor"
            placeholder="Choose a vendor"
            value={form.vendorId}
            disabled={!canSave}
            options={vendors.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(vendorId) => setForm((current) => applyRfqVendor(current, vendorId, vendors))}
          />
          <ChoiceField
            id="rfq-project"
            label="Project"
            placeholder="Optional (ADM when none)"
            value={form.projectId}
            disabled={!canSave}
            options={projects.map((item) => ({ value: item.id, label: item.name }))}
            onChange={(projectId) => setForm((current) => applyRfqProject(current, projectId, projects))}
          />
        </>
      ) : null}
      <TextField id="issued-on" label="Date" type="date" value={form.issuedOn} disabled={!canSave} onChange={(issuedOn) => setForm({ ...form, issuedOn })} />
      {form.kind === "rfq" ? (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextField
              id="due-on"
              label="Submission Deadline"
              type="date"
              value={body.dueOn}
              disabled={!canSave}
              onChange={(dueOn) => setBody({ dueOn })}
            />
            <TextField
              id="subtitle"
              label="Subtitle"
              value={body.subtitle}
              disabled={!canSave}
              onChange={(subtitle) => setBody({ subtitle })}
            />
            <TextField
              id="work-start"
              label="Tentative Work Start"
              type="date"
              value={body.startDate}
              disabled={!canSave}
              onChange={(startDate) => setBody({ startDate })}
            />
            <TextField
              id="work-end"
              label="Tentative Work End"
              type="date"
              value={body.completionDate}
              disabled={!canSave}
              onChange={(completionDate) => setBody({ completionDate })}
            />
          </div>
        </>
      ) : null}
      {form.kind === "payment_voucher" || form.kind === "salary_slip" ? (
        <ReadOnlyField label="Recorded Amount" value={lockedMoneyLabel(form.kind, form.lockedNet)} />
      ) : null}
      {form.kind === "letter" ? (
        <ChoiceField
          id="letter-kind"
          label="Kind"
          value={body.letterKind}
          disabled={!canSave}
          options={[
            { value: "letter", label: "Letter" },
            { value: "notice", label: "Notice" },
          ]}
          onChange={(letterKind) => setBody({ letterKind: letterKind === "notice" ? "notice" : "letter" })}
        />
      ) : null}
      <TextField
        id="party-name"
        label={
          form.kind === "salary_slip"
            ? "Employee Name"
            : form.kind === "letter"
              ? "Addressee"
              : form.kind === "rfq"
                ? "Recipient Name"
                : "Name"
        }
        value={body.partyName}
        disabled={!canSave}
        onChange={(partyName) => setBody({ partyName })}
      />
      {form.kind === "rfq" ? (
        <TextField
          id="vendor-company"
          label="Vendor Name"
          value={body.companyName}
          disabled={!canSave}
          onChange={(companyName) => setBody({ companyName })}
        />
      ) : null}
      <AreaField id="party-detail" label="Address" value={body.partyDetail} disabled={!canSave} onChange={(partyDetail) => setBody({ partyDetail })} />
      <TextField id="project-name" label="Project Name" value={body.projectName} disabled={!canSave} onChange={(projectName) => setBody({ projectName })} />
      {form.kind === "rfq" ? (
        <>
          <TextField id="rfq-subject" label="Subject" value={body.subject} disabled={!canSave} onChange={(subject) => setBody({ subject })} />
          <AreaField id="rfq-intro" label="Introduction" value={body.intro} disabled={!canSave} onChange={(intro) => setBody({ intro })} />
          <RfqEditor rows={body.rfqLines} disabled={!canSave} onChange={(rfqLines) => setBody({ rfqLines })} />
          <AreaField id="rfq-terms" label="Terms & Conditions" value={body.terms} disabled={!canSave} onChange={(terms) => setBody({ terms })} />
        </>
      ) : null}
      {form.kind === "delivery_challan" ? (
        <>
          <TextField id="wo" label="Client WO No." value={body.clientWoNo} disabled={!canSave} onChange={(clientWoNo) => setBody({ clientWoNo })} />
          <TextField id="from" label="Dispatched From" value={body.dispatchedFrom} disabled={!canSave} onChange={(dispatchedFrom) => setBody({ dispatchedFrom })} />
          <TextField id="vehicle" label="Vehicle No." value={body.vehicleNo} disabled={!canSave} onChange={(vehicleNo) => setBody({ vehicleNo })} />
          <TextField id="driver" label="Driver Name" value={body.driverName} disabled={!canSave} onChange={(driverName) => setBody({ driverName })} />
          <TextField id="packages" label="Packages" value={body.packages} disabled={!canSave} onChange={(packages) => setBody({ packages })} />
          <ChallanEditor rows={body.challanLines} disabled={!canSave} onChange={(challanLines) => setBody({ challanLines })} />
        </>
      ) : null}
      {form.kind === "payment_voucher" ? (
        <>
          <TextField id="against" label="Against WO No." value={body.againstRef} disabled={!canSave} onChange={(againstRef) => setBody({ againstRef })} />
          <TextField id="bill" label="Vendor Bill No." value={body.billNo} disabled={!canSave} onChange={(billNo) => setBody({ billNo })} />
          <TextField id="head" label="Account Head" value={body.accountHead} disabled={!canSave} onChange={(accountHead) => setBody({ accountHead })} />
          <TextField id="mode" label="Payment Mode" value={body.paymentMode} disabled={!canSave} onChange={(paymentMode) => setBody({ paymentMode })} />
          <AreaField id="narration" label="Narration" value={body.narration} disabled={!canSave} onChange={(narration) => setBody({ narration })} />
          <TextField id="particular" label="Particulars" value={body.subject} disabled={!canSave} onChange={(subject) => setBody({ subject })} />
          <MoneyRows label="Deductions" rows={body.deductions} disabled={!canSave} onChange={(deductions) => setBody({ deductions })} />
        </>
      ) : null}
      {form.kind === "completion" ? (
        <>
          <TextField id="wo-no" label="Work Order No." value={body.workOrderNo} disabled={!canSave} onChange={(workOrderNo) => setBody({ workOrderNo })} />
          <TextField id="site" label="Site Address" value={body.site} disabled={!canSave} onChange={(site) => setBody({ site })} />
          <TextField id="start" label="Start Date" value={body.startDate} disabled={!canSave} onChange={(startDate) => setBody({ startDate })} />
          <TextField id="end" label="Completion Date" value={body.completionDate} disabled={!canSave} onChange={(completionDate) => setBody({ completionDate })} />
          <AreaField id="intro" label="Certificate Text" value={body.intro} disabled={!canSave} onChange={(intro) => setBody({ intro })} />
          <AreaField id="scope" label="Scope Of Work" value={body.scope} disabled={!canSave} onChange={(scope) => setBody({ scope })} />
          <AreaField id="defect" label="Defect Liability" value={body.defect} disabled={!canSave} onChange={(defect) => setBody({ defect })} />
        </>
      ) : null}
      {form.kind === "salary_slip" ? (
        <>
          <TextField id="designation" label="Designation" value={body.designation} disabled={!canSave} onChange={(designation) => setBody({ designation })} />
          <TextField id="department" label="Department" value={body.department} disabled={!canSave} onChange={(department) => setBody({ department })} />
          <TextField id="period" label="Pay Period" value={body.periodLabel} disabled={!canSave} onChange={(periodLabel) => setBody({ periodLabel })} />
          <TextField id="days" label="Working Days" value={body.workingDays} disabled={!canSave} onChange={(workingDays) => setBody({ workingDays })} />
          <TextField id="attendance" label="Days Present / Leave" value={body.attendance} disabled={!canSave} onChange={(attendance) => setBody({ attendance })} />
          <TextField id="pay-mode" label="Payment Mode" value={body.payMode} disabled={!canSave} onChange={(payMode) => setBody({ payMode })} />
          <TextField id="account" label="Account No." value={body.accountNo} disabled={!canSave} onChange={(accountNo) => setBody({ accountNo })} />
          <MoneyRows label="Earnings" rows={body.earnings} disabled={!canSave} onChange={(earnings) => setBody({ earnings })} />
          <MoneyRows label="Deductions" rows={body.deductions} disabled={!canSave} onChange={(deductions) => setBody({ deductions })} />
        </>
      ) : null}
      {form.kind === "letter" ? (
        <>
          <TextField id="audience" label="Subtitle" value={body.audience} disabled={!canSave} onChange={(audience) => setBody({ audience })} />
          <TextField id="company" label="Company Name" value={body.companyName} disabled={!canSave} onChange={(companyName) => setBody({ companyName })} />
          <TextField id="subject" label="Subject" value={body.subject} disabled={!canSave} onChange={(subject) => setBody({ subject })} />
          <AreaField id="paragraphs" label="Letter" value={body.paragraphs} disabled={!canSave} onChange={(paragraphs) => setBody({ paragraphs })} />
          {body.letterKind === "notice" ? (
            <NoticeRows rows={body.noticeRows} disabled={!canSave} onChange={(noticeRows) => setBody({ noticeRows })} />
          ) : null}
          <TextField id="cc" label="Copies" value={body.cc} disabled={!canSave} onChange={(cc) => setBody({ cc })} />
        </>
      ) : null}
      <AreaField id="notes" label={form.kind === "rfq" ? "Submission Note" : "Notes"} value={body.notes} disabled={!canSave} onChange={(notes) => setBody({ notes })} />
      <EmployeeField id="prepared" label="Prepared By" value={body.preparedBy} employees={employees} disabled={!canSave} onChange={(preparedBy) => setBody({ preparedBy })} />
      <EmployeeField id="checked" label="Checked By" value={body.checkedBy} employees={employees} disabled={!canSave} onChange={(checkedBy) => setBody({ checkedBy })} />
      <EmployeeField id="authorized" label="Authorized By" value={body.authorizedBy} employees={employees} disabled={!canSave} onChange={(authorizedBy) => setBody({ authorizedBy })} />
      {form.kind === "rfq" ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id="submitted-enabled"
            checked={isSignatureEnabled(body.submittedBy)}
            disabled={!canSave}
            onCheckedChange={(checked) => setBody({ submittedBy: checked ? "" : SIGNATURE_OFF })}
          />
          <Label htmlFor="submitted-enabled" className="cursor-pointer">
            Quotation Submitted By
          </Label>
        </div>
      ) : null}
    </DocumentWorkspace>
  )
}

function RfqEditor({
  rows,
  disabled,
  onChange,
}: {
  rows: RfqRow[]
  disabled: boolean
  onChange: (rows: RfqRow[]) => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Label>Items</Label>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || rows.length >= 40}
          onClick={() =>
            onChange([...rows, { item: "", specification: "", unit: "", quantity: "", remarks: "" }])
          }
        >
          <Plus aria-hidden="true" data-icon="inline-start" />
          Add Item
        </Button>
      </div>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-col gap-3 rounded-card border border-border p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-ui font-semibold">Item {String(index + 1).padStart(2, "0")}</p>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled || rows.length === 1}
              aria-label={`Remove item ${index + 1}`}
              onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <TextField
              id={`rfq-item-${index}`}
              label="Item"
              value={row.item}
              disabled={disabled}
              onChange={(item) => update(rows, index, { item }, onChange)}
            />
            <TextField
              id={`rfq-spec-${index}`}
              label="Specification"
              value={row.specification}
              disabled={disabled}
              onChange={(specification) => update(rows, index, { specification }, onChange)}
            />
            <div className="flex flex-col gap-2">
              <Label htmlFor={`rfq-qty-${index}`}>Quantity</Label>
              <Input
                id={`rfq-qty-${index}`}
                inputMode="decimal"
                value={row.quantity}
                disabled={disabled}
                onChange={(event) => update(rows, index, { quantity: event.target.value }, onChange)}
              />
            </div>
            <TextField
              id={`rfq-unit-${index}`}
              label="Unit"
              value={row.unit}
              disabled={disabled}
              onChange={(unit) => update(rows, index, { unit }, onChange)}
            />
            <div className="md:col-span-2">
              <TextField
                id={`rfq-remarks-${index}`}
                label="Remarks"
                value={row.remarks}
                disabled={disabled}
                onChange={(remarks) => update(rows, index, { remarks }, onChange)}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function ChallanEditor({
  rows,
  disabled,
  onChange,
}: {
  rows: ChallanRow[]
  disabled: boolean
  onChange: (rows: ChallanRow[]) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Label>Items</Label>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-2 gap-2">
          <Input value={row.item} disabled={disabled} placeholder="Item" aria-label="Item" onChange={(event) => update(rows, index, { item: event.target.value }, onChange)} />
          <Input value={row.unit} disabled={disabled} placeholder="Unit" aria-label="Unit" onChange={(event) => update(rows, index, { unit: event.target.value }, onChange)} />
          <Input value={row.ordered} disabled={disabled} inputMode="decimal" placeholder="Qty Ordered" aria-label="Qty Ordered" onChange={(event) => update(rows, index, { ordered: event.target.value }, onChange)} />
          <Input value={row.delivered} disabled={disabled} inputMode="decimal" placeholder="Qty Delivered" aria-label="Qty Delivered" onChange={(event) => update(rows, index, { delivered: event.target.value }, onChange)} />
          <Input value={row.remarks} disabled={disabled} placeholder="Remarks" aria-label="Remarks" onChange={(event) => update(rows, index, { remarks: event.target.value }, onChange)} />
          <Button type="button" variant="outline" disabled={disabled} onClick={() => onChange(rows.filter((_, rowIndex) => rowIndex !== index))}>
            <Trash2 aria-hidden="true" data-icon="inline-start" />
            Remove
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => onChange([...rows, { item: "", specification: "", unit: "", ordered: "", delivered: "", remarks: "" }])}
      >
        <Plus aria-hidden="true" data-icon="inline-start" />
        Add Row
      </Button>
    </div>
  )
}

function MoneyRows({
  label,
  rows,
  disabled,
  onChange,
}: {
  label: string
  rows: TextRow[]
  disabled: boolean
  onChange: (rows: TextRow[]) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Label>{label}</Label>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-2 gap-2">
          <Input value={row.label} disabled={disabled} placeholder="Label" aria-label={`${label} label`} onChange={(event) => update(rows, index, { label: event.target.value }, onChange)} />
          <Input value={row.amount} disabled={disabled} inputMode="decimal" placeholder="Amount" aria-label={`${label} amount`} onChange={(event) => update(rows, index, { amount: event.target.value }, onChange)} />
        </div>
      ))}
      <Button type="button" variant="outline" disabled={disabled} onClick={() => onChange([...rows, { label: "", amount: "" }])}>
        <Plus aria-hidden="true" data-icon="inline-start" />
        Add Row
      </Button>
    </div>
  )
}

function NoticeRows({
  rows,
  disabled,
  onChange,
}: {
  rows: NoteRow[]
  disabled: boolean
  onChange: (rows: NoteRow[]) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <Label>Notice Items</Label>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-1 gap-2">
          <Input value={row.label} disabled={disabled} placeholder="Item" aria-label="Notice item" onChange={(event) => update(rows, index, { label: event.target.value }, onChange)} />
          <Input value={row.value} disabled={disabled} placeholder="Instruction" aria-label="Instruction" onChange={(event) => update(rows, index, { value: event.target.value }, onChange)} />
        </div>
      ))}
      <Button type="button" variant="outline" disabled={disabled} onClick={() => onChange([...rows, { label: "", value: "" }])}>
        <Plus aria-hidden="true" data-icon="inline-start" />
        Add Row
      </Button>
    </div>
  )
}

function update<T>(rows: T[], index: number, patch: Partial<T>, onChange: (rows: T[]) => void) {
  onChange(rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)))
}
