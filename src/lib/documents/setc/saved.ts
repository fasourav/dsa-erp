import { allows, type ModuleKey } from "@/lib/access"
import { getPrintMargins } from "@/lib/company-settings"
import { roleFor, customerDisplayName } from "@/lib/documents/drafts"
import { formToModel, type FormKind } from "@/lib/documents/form-model"
import { loadFormDraft } from "@/lib/documents/form-queries"
import { requestOrigin } from "@/lib/documents/origin"
import {
  presentInvoice,
  presentPurchaseOrder,
  presentQuotation,
  presentReceipt,
  presentWorkOrder,
} from "@/lib/documents/present"
import {
  loadDocumentCatalog,
  loadInvoiceDraft,
  loadLeadChoices,
  loadPurchaseOrderDraft,
  loadQuotationDraft,
  loadReceiptDraft,
  loadWorkOrderDraft,
} from "@/lib/documents/queries"
import { verifyUrl } from "@/lib/documents/verify-url"
import { getAccess } from "@/lib/permissions"
import type { PrintMargins } from "@/lib/documents/drafts"
import { savedRecordKinds, type DocumentModel, type SavedRecordKind } from "@/lib/documents/setc/types"

export { savedRecordKinds }
export type { SavedRecordKind }

const modulesFor: Record<SavedRecordKind, ModuleKey[]> = {
  quotation: ["quotations"],
  work_order: ["work_orders"],
  invoice: ["client_invoices"],
  receipt: ["client_invoices"],
  purchase_order: ["purchase_orders"],
  rfq: ["purchase_orders"],
  delivery_challan: ["purchase_orders", "projects"],
  payment_voucher: ["vendor_payments", "expenses"],
  completion: ["projects"],
  salary_slip: ["payroll"],
  letter: ["projects", "clients"],
}

export async function loadSavedDocument(kind: SavedRecordKind, id: string): Promise<
  | { model: DocumentModel; margins: PrintMargins; filenameNo: string }
  | { error: string; status: number }
> {
  const access = await getAccess()
  if (!access || access.status !== "active") return { error: "Sign in to download a document.", status: 401 }
  if (!modulesFor[kind].some((module) => allows(access, module, "view"))) {
    return { error: "You do not have permission to download this document.", status: 403 }
  }

  const [origin, margins, catalog] = await Promise.all([
    requestOrigin(),
    getPrintMargins(),
    loadDocumentCatalog(),
  ])
  const employees = catalog.employees

  if (kind === "quotation") {
    const [loaded, leads] = await Promise.all([loadQuotationDraft(id), loadLeadChoices()])
    if (!loaded.draft) return { error: loaded.error || "That document could not be found.", status: 404 }
    const form = loaded.draft
    const client = catalog.clients.find((item) => item.id === form.clientId)
    const lead = leads.find((item) => item.id === form.leadId)
    const project = catalog.projects.find((item) => item.id === form.projectId)
    const model: DocumentModel = {
      kind: "print",
      doc: presentQuotation({
        documentNo: form.documentNo,
        issuedOn: form.issuedOn,
        validUntil: form.validUntil,
        verifyUrl: verifyUrl(origin, form.verifyToken),
        preparedForName: client?.personName || client?.name || lead?.name || "",
        preparedForDetail: client?.detail || lead?.detail || "",
        clientName: client ? customerDisplayName(client) : lead?.name || "",
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
      }),
    }
    return { model, margins, filenameNo: form.documentNo }
  }

  if (kind === "work_order") {
    const loaded = await loadWorkOrderDraft(id)
    if (!loaded.draft) return { error: loaded.error || "That document could not be found.", status: 404 }
    const form = loaded.draft
    const vendor = catalog.vendors.find((item) => item.id === form.vendorId)
    const project = catalog.projects.find((item) => item.id === form.projectId)
    const model: DocumentModel = {
      kind: "print",
      doc: presentWorkOrder({
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
        subtitle: form.subtitle,
        preparedBy: form.preparedBy,
        preparedByRole: roleFor(employees, form.preparedBy),
        checkedBy: form.checkedBy,
        checkedByRole: roleFor(employees, form.checkedBy),
        authorizedBy: form.authorizedBy,
        authorizedByRole: roleFor(employees, form.authorizedBy),
      }),
    }
    return { model, margins, filenameNo: form.documentNo }
  }

  if (kind === "invoice") {
    const loaded = await loadInvoiceDraft(id)
    if (!loaded.draft) return { error: loaded.error || "That document could not be found.", status: 404 }
    const form = loaded.draft
    const model: DocumentModel = {
      kind: "print",
      doc: presentInvoice({
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
        bookAmount: form.bookAmount,
      }),
    }
    return { model, margins, filenameNo: form.documentNo || "Invoice" }
  }

  if (kind === "receipt") {
    const loaded = await loadReceiptDraft(id)
    if (!loaded.draft) return { error: loaded.error || "That document could not be found.", status: 404 }
    const form = loaded.draft
    const model: DocumentModel = {
      kind: "print",
      doc: presentReceipt({
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
        subtitle: form.subtitle,
        preparedBy: form.preparedBy,
        preparedByRole: roleFor(employees, form.preparedBy),
        checkedBy: form.checkedBy,
        checkedByRole: roleFor(employees, form.checkedBy),
        authorizedBy: form.authorizedBy,
        authorizedByRole: roleFor(employees, form.authorizedBy),
      }),
    }
    return { model, margins, filenameNo: form.documentNo || "Receipt" }
  }

  if (kind === "purchase_order") {
    const loaded = await loadPurchaseOrderDraft(id)
    if (!loaded.draft) return { error: loaded.error || "That document could not be found.", status: 404 }
    const form = loaded.draft
    const model: DocumentModel = {
      kind: "print",
      doc: presentPurchaseOrder({
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
    }
    return { model, margins, filenameNo: form.documentNo || "Purchase Order" }
  }

  const loaded = await loadFormDraft(kind as FormKind, id, {})
  if (!loaded.draft) return { error: loaded.error || "That document could not be found.", status: 404 }
  return {
    model: formToModel(loaded.draft, origin, employees),
    margins,
    filenameNo: loaded.draft.documentNo,
  }
}
