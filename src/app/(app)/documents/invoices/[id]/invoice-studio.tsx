"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { saveInvoicePrint, trashSavedDocument } from "@/app/(app)/documents/actions"
import { useCan } from "@/components/access-provider"
import { DocumentWorkspace } from "@/components/documents/document-workspace"
import {
  AreaField,
  EmployeeField,
  LineEditor,
  ReadOnlyField,
  TextField,
} from "@/components/documents/document-fields"
import { roleFor, type EmployeeChoice, type PrintMargins } from "@/lib/documents/drafts"
import { verifyUrl } from "@/lib/documents/verify-url"
import { presentInvoice } from "@/lib/documents/present"
import { Money } from "@/components/money"
import { savedToast } from "@/lib/saved"
import type { InvoiceDraft } from "@/lib/documents/queries"

export function InvoiceStudio({
  draft,
  employees,
  origin,
  margins,
}: {
  draft: InvoiceDraft
  employees: EmployeeChoice[]
  origin: string
  margins: PrintMargins
}) {
  const router = useRouter()
  const [form, setForm] = useState(draft)
  const [error, setError] = useState<string | null>(null)
  const [pending, startSave] = useTransition()
  const canSave = useCan("client_invoices", form.exists ? "edit" : "add")
  const preview = useMemo(
    () =>
      presentInvoice({
        documentNo: form.documentNo,
        issuedOn: form.issuedOn,
        dueOn: form.dueOn,
        verifyUrl: verifyUrl(origin, form.verifyToken),
        billToName: form.billToName,
        billToDetail: form.billToDetail,
        customerName: form.customerName,
        projectName: form.projectName,
        workOrderNo: form.workOrderNo,
        aitPercent: form.aitPercent,
        lines: form.lines,
        deductions: form.deductions,
        terms: form.terms,
        paymentNote: form.paymentNote,
        subtitle: form.subtitle,
        preparedBy: form.preparedBy,
        preparedByRole: roleFor(employees, form.preparedBy),
        checkedBy: form.checkedBy,
        checkedByRole: roleFor(employees, form.checkedBy),
        authorizedBy: form.authorizedBy,
        authorizedByRole: roleFor(employees, form.authorizedBy),
      }),
    [employees, form, origin],
  )

  return (
    <DocumentWorkspace
      title="Client Invoice"
      description="Prints the bill only. The letterhead and footer stay on the pad."
      margins={margins}
      preview={preview}
      canSave={canSave}
      canTrash={form.exists}
      trashName={form.documentNo || "This invoice"}
      onTrash={async () => {
        const result = await trashSavedDocument({ kind: "invoice", id: form.id })
        if (result.error) return result.error
        savedToast("Moved To Trash.")
        router.push("/documents/invoices")
        return null
      }}
      pending={pending}
      error={error}
      files={{ parentType: "client_invoice", parentId: form.id }}
      onSave={() => {
        setError(null)
        startSave(async () => {
          const result = await saveInvoicePrint({ ...form, invoiceId: form.id })
          if (result.error) {
            setError(result.error)
            return
          }
          setForm((current) => ({
            ...current,
            exists: true,
            documentNo: result.documentNo ?? current.documentNo,
            verifyToken: result.verifyToken ?? current.verifyToken,
          }))
        })
      }}
    >
      <ReadOnlyField label="Customer Name" value={form.customerName} />
      <ReadOnlyField label="Project Name" value={form.projectName} />
      <TextField
        id="subtitle"
        label="Subtitle"
        value={form.subtitle}
        disabled={!canSave}
        onChange={(subtitle) => setForm({ ...form, subtitle })}
      />
      <TextField
        id="bill-to-name"
        label="Bill To Name"
        value={form.billToName}
        disabled={!canSave}
        onChange={(billToName) => setForm({ ...form, billToName })}
      />
      <AreaField
        id="bill-to-detail"
        label="Bill To Address"
        value={form.billToDetail}
        disabled={!canSave}
        onChange={(billToDetail) => setForm({ ...form, billToDetail })}
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField
          id="due-on"
          label="Due Date"
          type="date"
          value={form.dueOn}
          disabled={!canSave}
          onChange={(dueOn) => setForm({ ...form, dueOn })}
        />
        <TextField
          id="work-order-no"
          label="Work Order No."
          value={form.workOrderNo}
          disabled={!canSave}
          onChange={(workOrderNo) => setForm({ ...form, workOrderNo })}
        />
        <TextField
          id="ait"
          label="AIT Percent"
          value={form.aitPercent}
          disabled={!canSave}
          onChange={(aitPercent) => setForm({ ...form, aitPercent })}
        />
      </div>
      <LineEditor
        lines={form.lines}
        disabled={!canSave}
        onChange={(lines) => setForm({ ...form, lines })}
      />
      {form.deductions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="font-medium">Payments received</p>
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {form.deductions.map((deduction) => (
              <li key={`${deduction.label}-${deduction.paidOn}`}>
                {deduction.label} · <Money value={deduction.amount} />
              </li>
            ))}
          </ul>
          {form.receivedNote ? <p className="text-sm text-muted-foreground">{form.receivedNote}</p> : null}
        </div>
      ) : null}
      <AreaField
        id="terms"
        label="Terms & Conditions"
        value={form.terms}
        disabled={!canSave}
        onChange={(terms) => setForm({ ...form, terms })}
      />
      <AreaField
        id="payment-note"
        label="Payment Note"
        value={form.paymentNote}
        disabled={!canSave}
        onChange={(paymentNote) => setForm({ ...form, paymentNote })}
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
    </DocumentWorkspace>
  )
}
