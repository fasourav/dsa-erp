"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { savePurchaseOrderPrint, trashSavedDocument } from "@/app/(app)/documents/actions"
import { useCan } from "@/components/access-provider"
import {
  AreaField,
  EmployeeField,
  LineEditor,
  ReadOnlyField,
  TextField,
} from "@/components/documents/document-fields"
import { DocumentWorkspace } from "@/components/documents/document-workspace"
import { roleFor, type EmployeeChoice, type PrintMargins } from "@/lib/documents/drafts"
import { verifyUrl } from "@/lib/documents/verify-url"
import { presentPurchaseOrder } from "@/lib/documents/present"
import { savedToast } from "@/lib/saved"
import type { PurchaseOrderDraft } from "@/lib/documents/queries"

export function PurchaseOrderStudio({
  draft,
  employees,
  origin,
  margins,
}: {
  draft: PurchaseOrderDraft
  employees: EmployeeChoice[]
  origin: string
  margins: PrintMargins
}) {
  const router = useRouter()
  const [form, setForm] = useState(draft)
  const [error, setError] = useState<string | null>(null)
  const [pending, startSave] = useTransition()
  const canSave = useCan("purchase_orders", form.exists ? "edit" : "add")
  const preview = useMemo(
    () =>
      presentPurchaseOrder({
        documentNo: form.documentNo,
        issuedOn: form.issuedOn,
        verifyUrl: verifyUrl(origin, form.verifyToken),
        vendorName: form.vendorName,
        vendorDetail: form.vendorDetail,
        projectName: form.projectName,
        site: form.site,
        receiver: form.receiver,
        deliveryOn: form.deliveryOn,
        lines: form.lines,
        carrying: form.carrying,
        terms: form.terms,
        subtitle: form.subtitle,
        preparedBy: form.preparedBy,
        preparedByRole: roleFor(employees, form.preparedBy),
        checkedBy: form.checkedBy,
        checkedByRole: roleFor(employees, form.checkedBy),
        authorizedBy: form.authorizedBy,
        authorizedByRole: roleFor(employees, form.authorizedBy),
        bookAmount: form.bookAmount,
      }),
    [employees, form, origin],
  )

  return (
    <DocumentWorkspace
      title="Purchase Order"
      description="Prints the order only. The letterhead and footer stay on the pad."
      margins={margins}
      source={{ kind: "print", doc: preview }}
      canSave={canSave}
      canTrash={Boolean(form.id)}
      trashName={form.documentNo || "This purchase order"}
      onTrash={async () => {
        const result = await trashSavedDocument({ kind: "purchase_order", id: form.id })
        if (result.error) return result.error
        savedToast("Moved To Trash.")
        router.push("/documents/purchase-orders")
        return null
      }}
      pending={pending}
      error={error}
      files={{ parentType: "purchase_order", parentId: form.id }}
      onSave={() => {
        setError(null)
        startSave(async () => {
          const result = await savePurchaseOrderPrint({
            ...form,
            purchaseOrderId: form.id,
          })
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
      <ReadOnlyField label="Vendor Name" value={form.vendorName} />
      <ReadOnlyField label="Project Name" value={form.projectName} />
      <TextField
        id="subtitle"
        label="Subtitle"
        value={form.subtitle}
        disabled={!canSave}
        onChange={(subtitle) => setForm({ ...form, subtitle })}
      />
      <AreaField
        id="vendor-detail"
        label="Vendor Address"
        value={form.vendorDetail}
        disabled={!canSave}
        onChange={(vendorDetail) => setForm({ ...form, vendorDetail })}
      />
      <TextField
        id="site"
        label="Site"
        value={form.site}
        disabled={!canSave}
        onChange={(site) => setForm({ ...form, site })}
      />
      <TextField
        id="receiver"
        label="Receiver"
        value={form.receiver}
        disabled={!canSave}
        onChange={(receiver) => setForm({ ...form, receiver })}
      />
      <TextField
        id="delivery-on"
        label="Delivery Date"
        type="date"
        value={form.deliveryOn}
        disabled={!canSave}
        onChange={(deliveryOn) => setForm({ ...form, deliveryOn })}
      />
      <TextField
        id="carrying"
        label="Carrying & Unloading"
        value={form.carrying}
        disabled={!canSave}
        onChange={(carrying) => setForm({ ...form, carrying })}
      />
      <LineEditor
        lines={form.lines}
        disabled={!canSave}
        onChange={(lines) => setForm({ ...form, lines })}
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
