import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import { isUuid } from "@/lib/ids"
import { dateInputValue } from "@/lib/project-validation"
import {
  isClientInvoiceStatus,
  moneyCents,
  sumAmounts,
} from "@/lib/payment-status"
import { createClient } from "@/lib/supabase/server"
import { mergeCategorySuggestions } from "@/lib/vendor-summary"
import type {
  ClientInvoiceRow,
  ClientPaymentRow,
  InvoiceProjectOption,
} from "@/lib/client-invoice-summary"

export type InvoiceProjectFilter = {
  id: string
  name: string
}

export async function getClientInvoices(projectId: string | null): Promise<{
  invoices: ClientInvoiceRow[]
  projects: InvoiceProjectOption[]
  paymentMethods: string[]
  projectFilter: InvoiceProjectFilter | null
  error: string | null
}> {
  const empty = {
    invoices: [] as ClientInvoiceRow[],
    projects: [] as InvoiceProjectOption[],
    paymentMethods: [] as string[],
    projectFilter: null,
    error: "Could not load client invoices.",
  }

  const supabase = await createClient()

  try {
    const [projectRows, clientRows, invoiceRows, paymentRows, methodRows] =
      await Promise.all([
        fetchAllPages(
          (from, to) =>
            supabase
              .from("projects")
              .select("id, name, client_id")
              .order("id", { ascending: true })
              .range(from, to),
          "Project list is larger than expected.",
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
              .from("client_invoices")
              .select(
                "id, project_id, client_id, issued_on, due_on, amount, status, description",
              )
              .order("id", { ascending: true })
              .range(from, to),
          "Client invoice list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("client_payments")
              .select(
                "id, client_invoice_id, paid_on, amount, method, reference, notes, remarks",
              )
              .order("id", { ascending: true })
              .range(from, to),
          "Client payment list is larger than expected.",
        ),
        fetchAllPages(
          (from, to) =>
            supabase
              .from("payment_methods")
              .select("name, sort_order")
              .order("sort_order", { ascending: true })
              .order("name", { ascending: true })
              .range(from, to),
          "Payment method list is larger than expected.",
        ),
      ])

    const clientsById = new Map(
      clientRows.flatMap((row) =>
        row.client_id ? [[row.client_id, row.display_name?.trim() ?? ""] as const] : [],
      ),
    )

    const projects = projectRows
      .map((row) => ({
        id: row.id,
        name: row.name?.trim() ?? "",
        clientId: row.client_id,
        clientName: clientsById.get(row.client_id) ?? "",
      }))
      .sort((left, right) =>
        left.name.localeCompare(right.name, "en", { sensitivity: "base" }),
      )

    const projectsById = new Map(projects.map((project) => [project.id, project]))
    const paymentsByInvoice = new Map<string, ClientPaymentRow[]>()

    for (const row of paymentRows) {
      const payment: ClientPaymentRow = {
        id: row.id,
        paidOn: dateInputValue(row.paid_on),
        amount: toNumber(row.amount),
        method: row.method?.trim() ?? "",
        reference: row.reference?.trim() ?? "",
        notes: row.notes ?? "",
        remarks: row.remarks ?? "",
      }
      const current = paymentsByInvoice.get(row.client_invoice_id) ?? []
      current.push(payment)
      paymentsByInvoice.set(row.client_invoice_id, current)
    }

    const invoices = invoiceRows.flatMap((row) => {
      if (!isClientInvoiceStatus(row.status)) {
        return []
      }

      const project = projectsById.get(row.project_id)
      const payments = paymentsByInvoice.get(row.id) ?? []
      const paid = sumAmounts(payments.map((payment) => payment.amount))
      const balance = Math.max(
        0,
        (moneyCents(toNumber(row.amount)) - moneyCents(paid)) / 100,
      )

      return [
        {
          id: row.id,
          projectId: row.project_id,
          projectName: project?.name ?? "",
          clientId: row.client_id,
          clientName:
            clientsById.get(row.client_id) ?? project?.clientName ?? "",
          issuedOn: dateInputValue(row.issued_on),
          dueOn: row.due_on ? dateInputValue(row.due_on) : "",
          amount: toNumber(row.amount),
          status: row.status,
          description: row.description ?? "",
          paid,
          balance,
          payments,
        } satisfies ClientInvoiceRow,
      ]
    })

    const requestedId = projectId && isUuid(projectId) ? projectId : null
    if (projectId && !requestedId) {
      return {
        invoices: [],
        projects,
        paymentMethods: methodRows.map((row) => row.name),
        projectFilter: null,
        error: "That project could not be found.",
      }
    }

    const matchedProject = requestedId
      ? projectsById.get(requestedId) ?? null
      : null

    if (requestedId && !matchedProject) {
      return {
        invoices: [],
        projects,
        paymentMethods: methodRows.map((row) => row.name),
        projectFilter: null,
        error: "That project could not be found.",
      }
    }

    const visibleInvoices = matchedProject
      ? invoices.filter((invoice) => invoice.projectId === matchedProject.id)
      : invoices

    return {
      invoices: visibleInvoices,
      projects,
      paymentMethods: mergeCategorySuggestions(
        methodRows.map((row) => row.name),
        visibleInvoices.flatMap((invoice) =>
          invoice.payments.map((payment) => payment.method),
        ),
      ),
      projectFilter: matchedProject
        ? { id: matchedProject.id, name: matchedProject.name }
        : null,
      error: null,
    }
  } catch {
    return empty
  }
}
