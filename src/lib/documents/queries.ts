import { fetchAllPages } from "@/lib/fetch-pages"
import { formatIsoDate, formatMoney, toNumber } from "@/lib/format"
import { isUuid } from "@/lib/ids"
import { dateInputValue } from "@/lib/project-validation"
import { createClient } from "@/lib/supabase/server"
import type { Json } from "@/types/database.types"

import {
  readBody,
  readText,
  parseLines,
  rowToLine,
  rowToMilestone,
} from "@/lib/documents/body"
import {
  blankLine,
  defaultSubtitles,
  partyDetail,
  type EmployeeChoice,
  type LineInput,
  type MilestoneInput,
  type NamedOption,
  type ProjectChoice,
} from "@/lib/documents/drafts"

export type DocumentListItem = {
  id: string
  title: string
  detail: string
  documentNo: string
  status?: string
}

export type DocumentCatalog = {
  clients: NamedOption[]
  projects: ProjectChoice[]
  vendors: NamedOption[]
  employees: EmployeeChoice[]
  paymentMethods: string[]
  error: string | null
}

export type MoneyDeduction = {
  label: string
  paidOn: string
  amount: number
}

export type InvoiceDraft = {
  id: string
  exists: boolean
  documentNo: string
  verifyToken: string
  issuedOn: string
  dueOn: string
  status: string
  billToName: string
  billToDetail: string
  customerName: string
  projectName: string
  workOrderNo: string
  aitPercent: string
  terms: string
  paymentNote: string
  subtitle: string
  preparedBy: string
  checkedBy: string
  authorizedBy: string
  lines: LineInput[]
  deductions: MoneyDeduction[]
  receivedNote: string
  bookAmount: number
}

export type ReceiptDraft = {
  id: string
  exists: boolean
  documentNo: string
  verifyToken: string
  issuedOn: string
  amount: number
  receivedFromName: string
  receivedFromDetail: string
  customerName: string
  againstInvoiceNo: string
  method: string
  reference: string
  description: string
  bankName: string
  transferMode: string
  creditedTo: string
  notes: string
  subtitle: string
  preparedBy: string
  checkedBy: string
  authorizedBy: string
}

export type PurchaseOrderDraft = {
  id: string
  exists: boolean
  documentNo: string
  verifyToken: string
  issuedOn: string
  vendorName: string
  vendorDetail: string
  projectName: string
  site: string
  receiver: string
  deliveryOn: string
  lines: LineInput[]
  carrying: string
  bookAmount: number
  terms: string
  subtitle: string
  preparedBy: string
  checkedBy: string
  authorizedBy: string
}

export type QuotationDraft = {
  id: string | null
  version?: string
  documentNo: string
  verifyToken: string
  issuedOn: string
  validUntil: string
  status: string
  clientId: string
  leadId: string
  projectId: string
  area: string
  subject: string
  terms: string
  exclusions: string
  aitPercent: string
  subtitle: string
  preparedBy: string
  checkedBy: string
  authorizedBy: string
  lines: LineInput[]
  milestones: MilestoneInput[]
}

export type WorkOrderDraft = {
  id: string | null
  version?: string
  documentNo: string
  verifyToken: string
  issuedOn: string
  status: string
  vendorId: string
  projectId: string
  purchaseOrderId: string
  proposalOn: string
  workStart: string
  workEnd: string
  subject: string
  introduction: string
  terms: string
  subtitle: string
  preparedBy: string
  checkedBy: string
  authorizedBy: string
  lines: LineInput[]
  milestones: MilestoneInput[]
}

const unavailable =
  "Document storage is not available until the business documents migration is applied."

function storageError(error: { message?: string; code?: string } | null): string | null {
  if (!error) return null
  const text = `${error.code ?? ""} ${error.message ?? ""}`
  if (/42P01|PGRST205|schema cache|does not exist|Could not find the table/i.test(text)) {
    return unavailable
  }
  return "Could not load documents."
}

function partyName(company: string, person: string, display: string): string {
  return display || company || person || "—"
}

function customerName(company: string, person: string, display: string): string {
  return company || person || display || "—"
}

export async function loadDocumentCatalog(): Promise<DocumentCatalog> {
  const supabase = await createClient()
  const empty: DocumentCatalog = {
    clients: [],
    projects: [],
    vendors: [],
    employees: [],
    paymentMethods: [],
    error: "Could not load document options.",
  }

  try {
    const [
      clientRows,
      summaryRows,
      projectRows,
      vendorRows,
      vendorSummaryRows,
      employeeRows,
      profileRows,
      roleTemplateRows,
      methodRows,
    ] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("clients")
            .select("id, person_name, company_name, address, phone, email")
            .order("id", { ascending: true })
            .range(from, to),
        "Client list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("client_summaries")
            .select("client_id, display_name")
            .order("client_id", { ascending: true })
            .range(from, to),
        "Client list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("projects")
            .select("id, name, client_id, location")
            .order("id", { ascending: true })
            .range(from, to),
        "Project list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("vendors")
            .select("id, person_name, company_name, address, phone, email")
            .order("id", { ascending: true })
            .range(from, to),
        "Vendor list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("vendor_summaries")
            .select("vendor_id, display_name")
            .order("vendor_id", { ascending: true })
            .range(from, to),
        "Vendor list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("employees_readable")
            .select("full_name, designation, department, is_active")
            .eq("is_active", true)
            .order("full_name", { ascending: true })
            .range(from, to),
        "Employee list is larger than expected.",
      ).catch(() => []),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("profiles")
            .select("display_name, designation, role, status")
            .eq("status", "active")
            .order("display_name", { ascending: true })
            .range(from, to),
        "Profile list is larger than expected.",
      ).catch(() => []),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("role_templates")
            .select("key, label")
            .order("key", { ascending: true })
            .range(from, to),
        "Role list is larger than expected.",
      ).catch(() => []),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("payment_methods")
            .select("name, sort_order")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        "Payment method list is larger than expected.",
      ).catch(() => []),
    ])

    const clientNames = new Map(
      summaryRows.flatMap((row) =>
        row.client_id ? [[row.client_id, row.display_name?.trim() ?? ""] as const] : [],
      ),
    )
    const vendorNames = new Map(
      vendorSummaryRows.flatMap((row) =>
        row.vendor_id ? [[row.vendor_id, row.display_name?.trim() ?? ""] as const] : [],
      ),
    )

    const clients = clientRows
      .map((row) => {
        const company = row.company_name?.trim() ?? ""
        const person = row.person_name?.trim() ?? ""
        const display = clientNames.get(row.id) ?? ""
        return {
          id: row.id,
          name: partyName(company, person, display),
          companyName: company,
          personName: person,
          detail: partyDetail([
            person && company ? person : "",
            company && person ? company : "",
            row.address,
            row.phone,
            row.email,
          ]),
        } satisfies NamedOption
      })
      .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }))

    const vendors = vendorRows
      .map((row) => {
        const company = row.company_name?.trim() ?? ""
        const person = row.person_name?.trim() ?? ""
        const display = vendorNames.get(row.id) ?? ""
        return {
          id: row.id,
          name: partyName(company, person, display),
          companyName: company,
          personName: person,
          detail: partyDetail([person, company, row.address, row.phone, row.email]),
        } satisfies NamedOption
      })
      .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }))

    const projects = projectRows
      .map((row) => ({
        id: row.id,
        name: row.name?.trim() || "—",
        clientId: row.client_id,
        location: row.location?.trim() ?? "",
      }))
      .sort((left, right) => left.name.localeCompare(right.name, "en", { sensitivity: "base" }))

    const roleLabels = new Map<string, string>([
      ["owner", "Owner"],
      ["admin", "Admin"],
      ["manager", "Manager"],
      ["accountant", "Accountant"],
      ["viewer", "Viewer"],
    ])
    for (const row of roleTemplateRows) {
      const key = row.key?.trim()
      const label = row.label?.trim()
      if (key && label) roleLabels.set(key, label)
    }

    const employeeByKey = new Map<string, EmployeeChoice>()
    for (const row of employeeRows) {
      const name = row.full_name?.trim() ?? ""
      if (!name) continue
      const designation = row.designation?.trim() || row.department?.trim() || ""
      employeeByKey.set(name.toLowerCase(), { name, designation })
    }
    for (const row of profileRows) {
      const name = row.display_name?.trim() ?? ""
      if (!name) continue
      const key = name.toLowerCase()
      const roleKey = row.role?.trim() ?? ""
      const roleTitle = roleLabels.get(roleKey) || roleKey
      const designation = row.designation?.trim() || roleTitle
      const existing = employeeByKey.get(key)
      if (!existing) {
        employeeByKey.set(key, { name, designation })
      } else if (!existing.designation && designation) {
        employeeByKey.set(key, { ...existing, designation })
      }
    }
    const employees = Array.from(employeeByKey.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
    )

    return {
      clients,
      projects,
      vendors,
      employees,
      paymentMethods: methodRows.map((row) => row.name).filter(Boolean),
      error: null,
    }
  } catch {
    return empty
  }
}

export async function loadLeadChoices(): Promise<NamedOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leads")
    .select("id, lead_name, project_name, phone, email")
    .order("lead_name", { ascending: true })
  if (error || !data) return []
  return data.map((row) => ({
    id: row.id,
    name: row.lead_name?.trim() || "Lead",
    detail: [row.project_name, row.phone, row.email].map((part) => part?.trim() ?? "").filter(Boolean).join("\n"),
    companyName: row.project_name?.trim() ?? "",
    personName: row.lead_name?.trim() ?? "",
  }))
}

export async function listInvoiceDocuments(): Promise<{
  items: DocumentListItem[]
  error: string | null
}> {
  const supabase = await createClient()
  try {
    const [invoices, clients, projects, prints] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("client_invoices")
            .select("id, client_id, project_id, issued_on, amount, status")
            .order("issued_on", { ascending: false })
            .range(from, to),
        "Client invoice list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("client_summaries")
            .select("client_id, display_name")
            .range(from, to),
        "Client list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase.from("projects").select("id, name").range(from, to),
        "Project list is larger than expected.",
      ),
      supabase
        .from("issued_documents")
        .select("client_invoice_id, document_no, deleted_at")
        .eq("kind", "invoice"),
    ])

    const printError = storageError(prints.error)
    const numbers = new Map<string, string>()
    const trashedIds = new Set<string>()
    for (const row of prints.data ?? []) {
      if (!row.client_invoice_id) continue
      if (row.deleted_at) {
        trashedIds.add(row.client_invoice_id)
      } else {
        numbers.set(row.client_invoice_id, row.document_no)
      }
    }
    const clientNames = new Map(
      clients.flatMap((row) =>
        row.client_id ? [[row.client_id, row.display_name?.trim() || "—"] as const] : [],
      ),
    )
    const projectNames = new Map(projects.map((row) => [row.id, row.name?.trim() || "—"]))

    return {
      items: invoices
        .filter((row) => row.status !== "void" && (!trashedIds.has(row.id) || numbers.has(row.id)))
        .map((row) => ({
          id: row.id,
          title: clientNames.get(row.client_id) || "—",
          detail: `${formatIsoDate(dateInputValue(row.issued_on))} · ${projectNames.get(row.project_id) || "—"} · ${formatMoney(toNumber(row.amount))}`,
          documentNo: numbers.get(row.id) ?? "",
        })),
      error: printError,
    }
  } catch {
    return { items: [], error: "Could not load client invoices." }
  }
}

export async function loadInvoiceDraft(id: string): Promise<{
  draft: InvoiceDraft | null
  error: string | null
}> {
  if (!isUuid(id)) return { draft: null, error: "That invoice could not be found." }
  const supabase = await createClient()
  const catalog = await loadDocumentCatalog()

  const [invoiceResult, paymentResult, printResult] = await Promise.all([
    supabase
      .from("client_invoices")
      .select("id, client_id, project_id, issued_on, due_on, amount, status, description")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("client_payments")
      .select("paid_on, amount, notes")
      .eq("client_invoice_id", id)
      .order("paid_on", { ascending: true }),
    supabase
      .from("issued_documents")
      .select("document_no, verify_token, body, issued_on")
      .eq("client_invoice_id", id)
      .is("deleted_at", null)
      .maybeSingle(),
  ])

  if (invoiceResult.error || !invoiceResult.data || invoiceResult.data.status === "void") {
    return { draft: null, error: "That invoice could not be found." }
  }

  const invoice = invoiceResult.data
  const client = catalog.clients.find((item) => item.id === invoice.client_id)
  const project = catalog.projects.find((item) => item.id === invoice.project_id)
  const body = readBody(printResult.data?.body)
  const savedLines = parseLines(body.lines)
  const amount = toNumber(invoice.amount)
  const deductions = (paymentResult.data ?? []).map((payment, index) => ({
    label: payment.notes?.trim() || `Installment ${String(index + 1).padStart(2, "0")}`,
    paidOn: dateInputValue(payment.paid_on),
    amount: toNumber(payment.amount),
  }))
  const received = deductions.reduce((total, row) => total + row.amount, 0)

  return {
    draft: {
      id: invoice.id,
      exists: Boolean(printResult.data),
      documentNo: printResult.data?.document_no ?? "",
      verifyToken: printResult.data?.verify_token ?? "",
      issuedOn: dateInputValue(invoice.issued_on),
      dueOn: readText(printResult.data?.body, "dueOn") || (invoice.due_on ? dateInputValue(invoice.due_on) : ""),
      status: invoice.status,
      billToName: readText(printResult.data?.body, "billToName") || client?.name || "",
      billToDetail: readText(printResult.data?.body, "billToDetail") || client?.detail || "",
      customerName: customerName(client?.companyName ?? "", client?.personName ?? "", client?.name ?? ""),
      projectName: project?.name ?? "",
      workOrderNo: readText(printResult.data?.body, "workOrderNo"),
      aitPercent: readText(printResult.data?.body, "aitPercent"),
      terms: readText(printResult.data?.body, "terms"),
      paymentNote: readText(printResult.data?.body, "paymentNote"),
      subtitle: readText(printResult.data?.body, "subtitle") || defaultSubtitles.invoice,
      preparedBy: readText(printResult.data?.body, "preparedBy"),
      checkedBy: readText(printResult.data?.body, "checkedBy"),
      authorizedBy: readText(printResult.data?.body, "authorizedBy"),
      lines:
        savedLines.length > 0
          ? savedLines
          : [
              {
                section: "",
                item: invoice.description?.trim() || "Professional services",
                specification: "",
                quantity: "1",
                unit: "Job",
                unitPrice: String(amount),
              },
            ],
      deductions,
      receivedNote:
        received > 0 ? `Received to date ${formatMoney(received)}.` : "",
      bookAmount: amount,
    },
    error: storageError(printResult.error),
  }
}

export async function listReceiptDocuments(): Promise<{
  items: DocumentListItem[]
  error: string | null
}> {
  const supabase = await createClient()
  try {
    const [payments, invoices, clients, prints] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("client_payments")
            .select("id, client_invoice_id, paid_on, amount, method")
            .order("paid_on", { ascending: false })
            .range(from, to),
        "Client payment list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase.from("client_invoices").select("id, client_id").range(from, to),
        "Client invoice list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase.from("client_summaries").select("client_id, display_name").range(from, to),
        "Client list is larger than expected.",
      ),
      supabase
        .from("issued_documents")
        .select("client_payment_id, document_no, deleted_at")
        .eq("kind", "receipt"),
    ])
    const invoiceClients = new Map(invoices.map((row) => [row.id, row.client_id]))
    const clientNames = new Map(
      clients.flatMap((row) =>
        row.client_id ? [[row.client_id, row.display_name?.trim() || "—"] as const] : [],
      ),
    )
    const numbers = new Map<string, string>()
    const trashedIds = new Set<string>()
    for (const row of prints.data ?? []) {
      if (!row.client_payment_id) continue
      if (row.deleted_at) {
        trashedIds.add(row.client_payment_id)
      } else {
        numbers.set(row.client_payment_id, row.document_no)
      }
    }

    return {
      items: payments
        .filter((row) => !trashedIds.has(row.id) || numbers.has(row.id))
        .map((row) => ({
          id: row.id,
          title: clientNames.get(invoiceClients.get(row.client_invoice_id) ?? "") || "—",
          detail: `${formatIsoDate(dateInputValue(row.paid_on))} · ${row.method?.trim() || "Payment"} · ${formatMoney(toNumber(row.amount))}`,
          documentNo: numbers.get(row.id) ?? "",
        })),
      error: storageError(prints.error),
    }
  } catch {
    return { items: [], error: "Could not load money receipts." }
  }
}

export async function loadReceiptDraft(id: string): Promise<{
  draft: ReceiptDraft | null
  error: string | null
}> {
  if (!isUuid(id)) return { draft: null, error: "That payment could not be found." }
  const supabase = await createClient()
  const catalog = await loadDocumentCatalog()
  const paymentResult = await supabase
    .from("client_payments")
    .select("id, client_invoice_id, paid_on, amount, method, reference, notes, bank_account_id")
    .eq("id", id)
    .maybeSingle()

  if (paymentResult.error || !paymentResult.data) {
    return { draft: null, error: "That payment could not be found." }
  }

  const payment = paymentResult.data
  const [invoiceResult, accountResult, printResult, invoicePrintResult] = await Promise.all([
    supabase
      .from("client_invoices")
      .select("id, client_id, project_id, description")
      .eq("id", payment.client_invoice_id)
      .maybeSingle(),
    supabase
      .from("bank_accounts")
      .select("name, bank_name, account_holder_name")
      .eq("id", payment.bank_account_id)
      .maybeSingle(),
    supabase
      .from("issued_documents")
      .select("document_no, verify_token, body")
      .eq("client_payment_id", id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("issued_documents")
      .select("document_no")
      .eq("client_invoice_id", payment.client_invoice_id)
      .eq("kind", "invoice")
      .is("deleted_at", null)
      .maybeSingle(),
  ])

  const invoice = invoiceResult.data
  const client = catalog.clients.find((item) => item.id === invoice?.client_id)
  const project = catalog.projects.find((item) => item.id === invoice?.project_id)
  const body = printResult.data?.body

  return {
    draft: {
      id: payment.id,
      exists: Boolean(printResult.data),
      documentNo: printResult.data?.document_no ?? "",
      verifyToken: printResult.data?.verify_token ?? "",
      issuedOn: dateInputValue(payment.paid_on),
      amount: toNumber(payment.amount),
      receivedFromName: readText(body, "receivedFromName") || client?.name || "",
      receivedFromDetail: readText(body, "receivedFromDetail") || client?.detail || "",
      customerName: customerName(client?.companyName ?? "", client?.personName ?? "", client?.name ?? ""),
      againstInvoiceNo: readText(body, "againstInvoiceNo") || invoicePrintResult.data?.document_no || "",
      method: readText(body, "method") || payment.method?.trim() || "",
      reference: readText(body, "reference") || payment.reference?.trim() || "",
      description:
        readText(body, "description") ||
        [client?.name, project?.name, invoice?.description?.trim()].filter(Boolean).join(" · "),
      bankName: accountResult.data?.bank_name?.trim() || "",
      transferMode: readText(body, "transferMode") || payment.method?.trim() || "",
      creditedTo:
        readText(body, "creditedTo") || accountResult.data?.account_holder_name?.trim() || accountResult.data?.name?.trim() || "",
      notes: readText(body, "notes") || payment.notes?.trim() || "",
      subtitle: readText(body, "subtitle") || defaultSubtitles.receipt,
      preparedBy: readText(body, "preparedBy"),
      checkedBy: readText(body, "checkedBy"),
      authorizedBy: readText(body, "authorizedBy"),
    },
    error: storageError(printResult.error),
  }
}

export async function listPurchaseOrderDocuments(): Promise<{
  items: DocumentListItem[]
  error: string | null
}> {
  const supabase = await createClient()
  try {
    const [orders, vendors, projects, prints] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("vendor_purchase_orders")
            .select("id, vendor_id, project_id, issued_on, total_value, work_type")
            .order("issued_on", { ascending: false })
            .range(from, to),
        "Purchase order list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase.from("vendor_summaries").select("vendor_id, display_name").range(from, to),
        "Vendor list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) => supabase.from("projects").select("id, name").range(from, to),
        "Project list is larger than expected.",
      ),
      supabase
        .from("issued_documents")
        .select("purchase_order_id, document_no, deleted_at")
        .eq("kind", "purchase_order"),
    ])
    const vendorNames = new Map(
      vendors.flatMap((row) =>
        row.vendor_id ? [[row.vendor_id, row.display_name?.trim() || "—"] as const] : [],
      ),
    )
    const projectNames = new Map(projects.map((row) => [row.id, row.name?.trim() || "—"]))
    const numbers = new Map<string, string>()
    const trashedIds = new Set<string>()
    for (const row of prints.data ?? []) {
      if (!row.purchase_order_id) continue
      if (row.deleted_at) {
        trashedIds.add(row.purchase_order_id)
      } else {
        numbers.set(row.purchase_order_id, row.document_no)
      }
    }

    return {
      items: orders
        .filter((row) => !trashedIds.has(row.id) || numbers.has(row.id))
        .map((row) => ({
          id: row.id,
          title: vendorNames.get(row.vendor_id) || "—",
          detail: `${formatIsoDate(dateInputValue(row.issued_on))} · ${row.project_id ? projectNames.get(row.project_id) || "—" : "—"} · ${formatMoney(toNumber(row.total_value))}`,
          documentNo: numbers.get(row.id) ?? "",
        })),
      error: storageError(prints.error),
    }
  } catch {
    return { items: [], error: "Could not load purchase orders." }
  }
}

export async function loadPurchaseOrderDraft(id: string): Promise<{
  draft: PurchaseOrderDraft | null
  error: string | null
}> {
  if (!isUuid(id)) return { draft: null, error: "That purchase order could not be found." }
  const supabase = await createClient()
  const catalog = await loadDocumentCatalog()
  const orderResult = await supabase
    .from("vendor_purchase_orders")
    .select("id, vendor_id, project_id, issued_on, total_value, work_type, notes")
    .eq("id", id)
    .maybeSingle()

  if (orderResult.error || !orderResult.data) {
    return { draft: null, error: "That purchase order could not be found." }
  }

  const order = orderResult.data
  const printResult = await supabase
    .from("issued_documents")
    .select("document_no, verify_token, body")
    .eq("purchase_order_id", id)
    .is("deleted_at", null)
    .maybeSingle()
  const vendor = catalog.vendors.find((item) => item.id === order.vendor_id)
  const project = catalog.projects.find((item) => item.id === order.project_id)
  const body = printResult.data?.body
  const savedLines = parseLines(readBody(body).lines)

  return {
    draft: {
      id: order.id,
      exists: Boolean(printResult.data),
      documentNo: printResult.data?.document_no ?? "",
      verifyToken: printResult.data?.verify_token ?? "",
      issuedOn: dateInputValue(order.issued_on),
      vendorName: vendor?.name ?? "",
      vendorDetail: readText(body, "vendorDetail") || vendor?.detail || "",
      projectName: project?.name ?? "",
      site: readText(body, "site") || project?.location || "",
      receiver: readText(body, "receiver"),
      deliveryOn: readText(body, "deliveryOn"),
      carrying: readText(body, "carrying"),
      bookAmount: toNumber(order.total_value),
      terms: readText(body, "terms") || order.notes?.trim() || "",
      subtitle: readText(body, "subtitle") || defaultSubtitles.purchaseOrder,
      preparedBy: readText(body, "preparedBy"),
      checkedBy: readText(body, "checkedBy"),
      authorizedBy: readText(body, "authorizedBy"),
      lines:
        savedLines.length > 0
          ? savedLines
          : [
              {
                section: "",
                item: order.work_type?.trim() || "Materials",
                specification: "",
                quantity: "1",
                unit: "Lot",
                unitPrice: String(toNumber(order.total_value)),
              },
            ],
    },
    error: storageError(printResult.error),
  }
}

export async function listQuotations(): Promise<{
  items: DocumentListItem[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("quotations")
    .select("id, document_no, issued_on, client_id, total, status")
    .is("deleted_at", null)
    .order("issued_on", { ascending: false })
  const missing = storageError(error)
  if (error) return { items: [], error: missing }
  const catalog = await loadDocumentCatalog()
  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: catalog.clients.find((client) => client.id === row.client_id)?.name || "—",
      detail: `${formatIsoDate(dateInputValue(row.issued_on))} · ${formatMoney(toNumber(row.total))}`,
      documentNo: row.document_no,
      status: row.status,
    })),
    error: catalog.error,
  }
}

export async function loadQuotationDraft(id: string | null): Promise<{
  draft: QuotationDraft | null
  error: string | null
}> {
  if (!id) {
    const { todayIsoDate } = await import("@/lib/project-validation")
    return {
      draft: {
        id: null,
        documentNo: "",
        verifyToken: "",
        issuedOn: todayIsoDate(),
        validUntil: "",
        status: "draft",
        clientId: "",
        leadId: "",
        projectId: "",
        area: "",
        subject: "",
        terms: "",
        exclusions: "",
        aitPercent: "",
        subtitle: defaultSubtitles.quotation,
        preparedBy: "",
        checkedBy: "",
        authorizedBy: "",
        lines: [blankLine()],
        milestones: [],
      },
      error: null,
    }
  }

  if (!isUuid(id)) return { draft: null, error: "That quotation could not be found." }
  const supabase = await createClient()
  const quotation = await supabase.from("quotations").select("*").eq("id", id).is("deleted_at", null).maybeSingle()
  if (quotation.error) return { draft: null, error: storageError(quotation.error) }
  if (!quotation.data) return { draft: null, error: "That quotation could not be found." }

  const [lines, milestones] = await Promise.all([
    supabase
      .from("quotation_lines")
      .select("section_name, item, specification, quantity, unit, unit_price, sort_order")
      .eq("quotation_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("quotation_milestones")
      .select("label, percent, sort_order")
      .eq("quotation_id", id)
      .order("sort_order", { ascending: true }),
  ])

  const row = quotation.data
  return {
    draft: {
      id: row.id,
      documentNo: row.document_no,
      verifyToken: row.verify_token,
      version: row.updated_at,
      issuedOn: dateInputValue(row.issued_on),
      validUntil: row.valid_until ? dateInputValue(row.valid_until) : "",
      status: row.status,
      clientId: row.client_id ?? "",
      leadId: row.lead_id ?? "",
      projectId: row.project_id ?? "",
      area: row.area,
      subject: row.subject,
      terms: row.terms,
      exclusions: row.exclusions,
      aitPercent: String(row.ait_percent),
      subtitle: row.subtitle?.trim() || defaultSubtitles.quotation,
      preparedBy: row.prepared_by,
      checkedBy: row.checked_by,
      authorizedBy: row.authorized_by,
      lines: (lines.data ?? []).map(rowToLine),
      milestones: (milestones.data ?? []).map(rowToMilestone),
    },
    error: null,
  }
}

export async function listWorkOrders(): Promise<{
  items: DocumentListItem[]
  error: string | null
}> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("work_orders")
    .select("id, document_no, issued_on, vendor_id, total, status")
    .is("deleted_at", null)
    .order("issued_on", { ascending: false })
  if (error) return { items: [], error: storageError(error) }
  const catalog = await loadDocumentCatalog()
  return {
    items: (data ?? []).map((row) => ({
      id: row.id,
      title: catalog.vendors.find((vendor) => vendor.id === row.vendor_id)?.name || "—",
      detail: `${formatIsoDate(dateInputValue(row.issued_on))} · ${formatMoney(toNumber(row.total))}`,
      documentNo: row.document_no,
      status: row.status,
    })),
    error: catalog.error,
  }
}

export async function loadWorkOrderDraft(id: string | null): Promise<{
  draft: WorkOrderDraft | null
  error: string | null
}> {
  if (!id) {
    const { todayIsoDate } = await import("@/lib/project-validation")
    return {
      draft: {
        id: null,
        documentNo: "",
        verifyToken: "",
        issuedOn: todayIsoDate(),
        status: "draft",
        vendorId: "",
        projectId: "",
        purchaseOrderId: "",
        proposalOn: "",
        workStart: "",
        workEnd: "",
        subject: "",
        introduction: "",
        terms: "",
        subtitle: defaultSubtitles.workOrder,
        preparedBy: "",
        checkedBy: "",
        authorizedBy: "",
        lines: [blankLine()],
        milestones: [],
      },
      error: null,
    }
  }

  if (!isUuid(id)) return { draft: null, error: "That work order could not be found." }
  const supabase = await createClient()
  const order = await supabase.from("work_orders").select("*").eq("id", id).is("deleted_at", null).maybeSingle()
  if (order.error) return { draft: null, error: storageError(order.error) }
  if (!order.data) return { draft: null, error: "That work order could not be found." }

  const [lines, milestones] = await Promise.all([
    supabase
      .from("work_order_lines")
      .select("section_name, item, specification, quantity, unit, unit_price, sort_order")
      .eq("work_order_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("work_order_milestones")
      .select("label, percent, sort_order")
      .eq("work_order_id", id)
      .order("sort_order", { ascending: true }),
  ])
  const row = order.data
  return {
    draft: {
      id: row.id,
      documentNo: row.document_no,
      verifyToken: row.verify_token,
      version: row.updated_at,
      issuedOn: dateInputValue(row.issued_on),
      status: row.status,
      vendorId: row.vendor_id,
      projectId: row.project_id ?? "",
      purchaseOrderId: row.purchase_order_id ?? "",
      proposalOn: row.proposal_on ? dateInputValue(row.proposal_on) : "",
      workStart: row.work_start ? dateInputValue(row.work_start) : "",
      workEnd: row.work_end ? dateInputValue(row.work_end) : "",
      subject: row.subject,
      introduction: row.introduction,
      terms: row.terms,
      subtitle: row.subtitle?.trim() || defaultSubtitles.workOrder,
      preparedBy: row.prepared_by,
      checkedBy: row.checked_by,
      authorizedBy: row.authorized_by,
      lines: (lines.data ?? []).map(rowToLine),
      milestones: (milestones.data ?? []).map(rowToMilestone),
    },
    error: null,
  }
}

export type { Json }

export type PurchaseOrderChoice = {
  id: string
  label: string
  vendorId: string
  projectId: string
  workType: string
  notes: string
  totalValue: number
}

/** Purchase orders for the work order picker, labelled by work type, vendor, project and date (never ids). */
export async function loadPurchaseOrderChoices(catalog: DocumentCatalog): Promise<PurchaseOrderChoice[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("vendor_purchase_orders")
    .select("id, vendor_id, project_id, issued_on, work_type, notes, total_value")
    .order("issued_on", { ascending: false })
    .limit(500)
  return (data ?? []).map((row) => {
    const vendor = catalog.vendors.find((item) => item.id === row.vendor_id)?.name || "Vendor"
    const project = row.project_id
      ? catalog.projects.find((item) => item.id === row.project_id)?.name || "Project"
      : "Operational"
    const workType = row.work_type?.trim() || "Purchase Order"
    return {
      id: row.id,
      label: `${workType} · ${vendor} · ${project} · ${formatIsoDate(dateInputValue(row.issued_on))}`,
      vendorId: row.vendor_id,
      projectId: row.project_id ?? "",
      workType: row.work_type?.trim() ?? "",
      notes: row.notes?.trim() ?? "",
      totalValue: toNumber(row.total_value),
    }
  })
}

/** The work order already printed for a purchase order, if any. Null before the link migration is applied. */
export async function workOrderForPurchaseOrder(purchaseOrderId: string): Promise<string | null> {
  if (!isUuid(purchaseOrderId)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("work_orders")
    .select("id")
    .eq("purchase_order_id", purchaseOrderId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
  if (error) return null
  return data?.[0]?.id ?? null
}

export type TrashedDocument = {
  id: string
  kind: "quotation" | "work_order" | "invoice" | "receipt" | "purchase_order" | "delivery_challan" | "payment_voucher" | "completion" | "salary_slip" | "letter"
  kindLabel: string
  documentNo: string
  detail: string
}

export async function listTrashedDocuments(): Promise<{
  items: TrashedDocument[]
  error: string | null
}> {
  const supabase = await createClient()
  const [quotations, orders, issued, forms] = await Promise.all([
    supabase
      .from("quotations")
      .select("id, document_no, issued_on, deleted_at")
      .not("deleted_at", "is", null),
    supabase
      .from("work_orders")
      .select("id, document_no, issued_on, deleted_at")
      .not("deleted_at", "is", null),
    supabase
      .from("issued_documents")
      .select("id, kind, document_no, issued_on, deleted_at, status")
      .not("deleted_at", "is", null)
      .neq("status", "deleted"),
    supabase
      .from("form_documents")
      .select("id, kind, document_no, issued_on, deleted_at")
      .not("deleted_at", "is", null),
  ])
  const formMissing = forms.error && /42P01|PGRST205|schema cache|does not exist|Could not find the table/i.test(`${forms.error.code ?? ""} ${forms.error.message ?? ""}`)
  const error = quotations.error ?? orders.error ?? issued.error ?? (formMissing ? null : forms.error)
  if (error) return { items: [], error: storageError(error) }

  const items: Array<TrashedDocument & { deletedAt: string }> = [
    ...(quotations.data ?? []).map((row) => ({
      id: row.id,
      kind: "quotation" as const,
      kindLabel: "Quotation",
      documentNo: row.document_no,
      detail: formatIsoDate(dateInputValue(row.issued_on)),
      deletedAt: row.deleted_at ?? "",
    })),
    ...(orders.data ?? []).map((row) => ({
      id: row.id,
      kind: "work_order" as const,
      kindLabel: "Work Order",
      documentNo: row.document_no,
      detail: formatIsoDate(dateInputValue(row.issued_on)),
      deletedAt: row.deleted_at ?? "",
    })),
    ...(issued.data ?? []).flatMap((row) => {
      const kind: TrashedDocument["kind"] =
        row.kind === "invoice" ? "invoice" : row.kind === "receipt" ? "receipt" : "purchase_order"
      const kindLabel =
        kind === "invoice" ? "Invoice" : kind === "receipt" ? "Money Receipt" : "Purchase Order"
      return [
        {
          id: row.id,
          kind,
          kindLabel,
          documentNo: row.document_no,
          detail: formatIsoDate(dateInputValue(row.issued_on)),
          deletedAt: row.deleted_at ?? "",
        },
      ]
    }),
    ...(formMissing ? [] : (forms.data ?? [])).map((row) => ({
      id: row.id,
      kind: row.kind as TrashedDocument["kind"],
      kindLabel:
        row.kind === "delivery_challan"
          ? "Delivery Challan"
          : row.kind === "payment_voucher"
            ? "Payment Voucher"
            : row.kind === "completion"
              ? "Work Completion Certificate"
              : row.kind === "salary_slip"
                ? "Salary Slip"
                : "Letter / Notice",
      documentNo: row.document_no,
      detail: formatIsoDate(dateInputValue(row.issued_on)),
      deletedAt: row.deleted_at ?? "",
    })),
  ]
  items.sort((left, right) => right.deletedAt.localeCompare(left.deletedAt))
  return {
    items: items.map((item) => ({
      id: item.id,
      kind: item.kind,
      kindLabel: item.kindLabel,
      documentNo: item.documentNo,
      detail: item.detail,
    })),
    error: null,
  }
}
