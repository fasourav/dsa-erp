import { createClient } from "@/lib/supabase/server"
import { fetchAllPages } from "@/lib/fetch-pages"

export type ProjectDetail = {
  id: string
  name: string
  clientName: string
  clientId: string
  location: string
  startedOn: string
  completedOn: string
  projectType: string
  status: string
  currentPhase: string
  totalValue: number
  details: string
}

export type ProjectFinancial = {
  totalValue: number
  totalPaid: number
  totalPendingDue: number
  expenseTotal: number
  expenseDue: number
  grossProfit: number
  backlogAmount: number
}

export type LinkedPO = {
  id: string
  vendorName: string
  issuedOn: string
  totalValue: number
  workType: string
}

export type LinkedInvoice = {
  id: string
  issuedOn: string
  amount: number
  status: string
  description: string
}

export type BacklogEntry = {
  projectId: string
  projectName: string
  projectValue: number
  backlogAmount: number
  clientName: string
}

export async function getProjectDetail(projectId: string): Promise<{
  project: ProjectDetail | null
  financial: ProjectFinancial | null
  purchaseOrders: LinkedPO[]
  invoices: LinkedInvoice[]
  backlog: BacklogEntry | null
  error: string | null
}> {
  const supabase = await createClient()

  try {
    const { data: projData, error: projErr } = await supabase
      .from("projects")
      .select(
        "id, name, client_id, location, started_on, completed_on, project_type, status, current_phase, total_value, details",
      )
      .eq("id", projectId)
      .limit(1)

    if (projErr) throw projErr
    if (!projData || projData.length === 0) {
      return {
        project: null,
        financial: null,
        purchaseOrders: [],
        invoices: [],
        backlog: null,
        error: "Project not found.",
      }
    }

    const p = projData[0]

    const { data: clientData } = await supabase
      .from("clients")
      .select("person_name, company_name")
      .eq("id", p.client_id)
      .limit(1)

    const client = clientData?.[0]
    const clientName =
      client?.company_name?.trim() || client?.person_name?.trim() || ""

    const project: ProjectDetail = {
      id: p.id,
      name: p.name,
      clientName,
      clientId: p.client_id,
      location: p.location ?? "",
      startedOn: p.started_on,
      completedOn: p.completed_on ?? "",
      projectType: p.project_type ?? "",
      status: p.status,
      currentPhase: p.current_phase ?? "",
      totalValue: p.total_value,
      details: p.details ?? "",
    }

    const [finRows, poRows, invRows, blRows] = await Promise.all([
      supabase
        .from("project_financials")
        .select("*")
        .eq("project_id", projectId)
        .limit(1),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("vendor_purchase_orders")
            .select("id, vendor_id, issued_on, total_value, work_type")
            .eq("project_id", projectId)
            .order("issued_on", { ascending: false })
            .range(from, to),
        "PO list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("client_invoices")
            .select("id, issued_on, amount, status, description")
            .eq("project_id", projectId)
            .order("issued_on", { ascending: false })
            .range(from, to),
        "Invoice list is larger than expected.",
      ),
      supabase
        .from("project_backlogs")
        .select("*")
        .eq("project_id", projectId)
        .limit(1),
    ])

    const fin = finRows.data?.[0]
    const financial: ProjectFinancial | null = fin
      ? {
          totalValue: fin.total_value ?? 0,
          totalPaid: fin.total_paid ?? 0,
          totalPendingDue: fin.total_pending_due ?? 0,
          expenseTotal: fin.expense_total ?? 0,
          expenseDue: fin.expense_due ?? 0,
          grossProfit: fin.gross_profit ?? 0,
          backlogAmount: fin.backlog_amount ?? 0,
        }
      : null

    const vendorIds = [...new Set(poRows.map((po) => po.vendor_id))]
    const vendorMap = new Map<string, string>()
    if (vendorIds.length > 0) {
      const { data: vendorData } = await supabase
        .from("vendors")
        .select("id, person_name, company_name")
        .in("id", vendorIds)

      for (const v of vendorData ?? []) {
        vendorMap.set(
          v.id,
          v.company_name?.trim() || v.person_name?.trim() || "",
        )
      }
    }

    const purchaseOrders: LinkedPO[] = poRows.map((po) => ({
      id: po.id,
      vendorName: vendorMap.get(po.vendor_id) ?? "",
      issuedOn: po.issued_on,
      totalValue: po.total_value,
      workType: po.work_type ?? "",
    }))

    const invoices: LinkedInvoice[] = invRows.map((inv) => ({
      id: inv.id,
      issuedOn: inv.issued_on,
      amount: inv.amount,
      status: inv.status,
      description: inv.description ?? "",
    }))

    const bl = blRows.data?.[0]
    const backlog: BacklogEntry | null = bl
      ? {
          projectId: bl.project_id ?? "",
          projectName: bl.project_name ?? "",
          projectValue: bl.project_value ?? 0,
          backlogAmount: bl.backlog_amount ?? 0,
          clientName: bl.client_name ?? "",
        }
      : null

    return { project, financial, purchaseOrders, invoices, backlog, error: null }
  } catch {
    return {
      project: null,
      financial: null,
      purchaseOrders: [],
      invoices: [],
      backlog: null,
      error: "Could not load project details.",
    }
  }
}
