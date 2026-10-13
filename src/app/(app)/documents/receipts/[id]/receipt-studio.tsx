"use client"

import { useMemo, useState, useTransition } from "react"

import { saveReceiptPrint } from "@/app/(app)/documents/actions"
import { useCan } from "@/components/access-provider"
import {
  AreaField,
  ChoiceField,
  EmployeeField,
  ReadOnlyField,
  TextField,
} from "@/components/documents/document-fields"
import { DocumentWorkspace } from "@/components/documents/document-workspace"
import { roleFor, type EmployeeChoice, type PrintMargins } from "@/lib/documents/drafts"
import { verifyUrl } from "@/lib/documents/verify-url"
import { presentReceipt } from "@/lib/documents/present"
import { formatMoney } from "@/lib/format"
import type { ReceiptDraft } from "@/lib/documents/queries"

export function ReceiptStudio({
  draft,
  employees,
  paymentMethods,
  origin,
  margins,
}: {
  draft: ReceiptDraft
  employees: EmployeeChoice[]
  paymentMethods: string[]
  origin: string
  margins: PrintMargins
}) {
  const [form, setForm] = useState(draft)
  const [error, setError] = useState<string | null>(null)
  const [pending, startSave] = useTransition()
  const canSave = useCan("client_invoices", form.exists ? "edit" : "add")
  const methods = Array.from(new Set([form.method, ...paymentMethods].filter(Boolean)))
  const preview = useMemo(
    () =>
      presentReceipt({
        documentNo: form.documentNo,
        issuedOn: form.issuedOn,
        verifyUrl: verifyUrl(origin, form.verifyToken),
        receivedFromName: form.receivedFromName,
        receivedFromDetail: form.receivedFromDetail,
        customerName: form.customerName,
        againstInvoiceNo: form.againstInvoiceNo,
        method: form.method,
        reference: form.reference,
        description: form.description,
        amount: form.amount,
        bankName: form.bankName,
        transferMode: form.transferMode,
        creditedTo: form.creditedTo,
        notes: form.notes,
        preparedBy: form.preparedBy,
        preparedByRole: roleFor(employees, form.preparedBy),
      }),
    [employees, form, origin],
  )

  return (
    <DocumentWorkspace
      title="Money Receipt"
      description="Prints the receipt only. The letterhead and footer stay on the pad."
      margins={margins}
      preview={preview}
      canSave={canSave}
      pending={pending}
      error={error}
      files={{ parentType: "client_payment", parentId: form.id }}
      onSave={() => {
        setError(null)
        startSave(async () => {
          const result = await saveReceiptPrint({ ...form, paymentId: form.id })
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
      <ReadOnlyField label="Amount" value={formatMoney(form.amount)} />
      <ReadOnlyField label="Bank Name" value={form.bankName} />
      <TextField
        id="received-from"
        label="Received From"
        value={form.receivedFromName}
        disabled={!canSave}
        onChange={(receivedFromName) => setForm({ ...form, receivedFromName })}
      />
      <AreaField
        id="received-detail"
        label="Received From Address"
        value={form.receivedFromDetail}
        disabled={!canSave}
        onChange={(receivedFromDetail) => setForm({ ...form, receivedFromDetail })}
      />
      <TextField
        id="against"
        label="Against Invoice No."
        value={form.againstInvoiceNo}
        disabled={!canSave}
        onChange={(againstInvoiceNo) => setForm({ ...form, againstInvoiceNo })}
      />
      <ChoiceField
        id="method"
        label="Payment Method"
        value={form.method}
        disabled={!canSave}
        options={methods.map((method) => ({ value: method, label: method }))}
        onChange={(method) => setForm({ ...form, method })}
      />
      <TextField
        id="reference"
        label="Transaction Ref."
        value={form.reference}
        disabled={!canSave}
        onChange={(reference) => setForm({ ...form, reference })}
      />
      <AreaField
        id="description"
        label="Description"
        value={form.description}
        disabled={!canSave}
        onChange={(description) => setForm({ ...form, description })}
      />
      <TextField
        id="transfer-mode"
        label="Transfer Mode"
        value={form.transferMode}
        disabled={!canSave}
        onChange={(transferMode) => setForm({ ...form, transferMode })}
      />
      <TextField
        id="credited-to"
        label="Credited To"
        value={form.creditedTo}
        disabled={!canSave}
        onChange={(creditedTo) => setForm({ ...form, creditedTo })}
      />
      <AreaField
        id="notes"
        label="Notes"
        value={form.notes}
        disabled={!canSave}
        onChange={(notes) => setForm({ ...form, notes })}
      />
      <EmployeeField
        id="prepared-by"
        label="Received By"
        value={form.preparedBy}
        employees={employees}
        disabled={!canSave}
        onChange={(preparedBy) => setForm({ ...form, preparedBy })}
      />
    </DocumentWorkspace>
  )
}
