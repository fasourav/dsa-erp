import { toNumber } from "@/lib/format"
import { openPayableByPurchaseOrder } from "@/lib/open-payable"
import { dateInputValue } from "@/lib/project-validation"
import {
  type ExpenseCategoryOption,
  type ProjectOption,
  type PurchaseOrderRow,
  type VendorOption,
} from "@/lib/purchase-order-summary"
import { createClient } from "@/lib/supabase/server"
import { mergeCategorySuggestions } from "@/lib/vendor-summary"

const PAGE_SIZE = 1000
const MAX_PAGES = 100

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ProjectFilter = {
  id: string
  name: string
}

export async function getPurchaseOrders(projectId: string | null): Promise<{
  orders: PurchaseOrderRow[]
  projects: ProjectOption[]
  vendors: VendorOption[]
  workTypes: string[]
  expenseCategories: ExpenseCategoryOption[]
  officeExpenseCategories: ExpenseCategoryOption[]
  projectFilter: ProjectFilter | null
  error: string | null
}> {
  const supabase = await createClient()
  const empty = {
    orders: [] as PurchaseOrderRow[],
    projects: [] as ProjectOption[],
    vendors: [] as VendorOption[],
    workTypes: [] as string[],
    expenseCategories: [] as ExpenseCategoryOption[],
    officeExpenseCategories: [] as ExpenseCategoryOption[],
    projectFilter: null,
    error: "Could not load purchase orders.",
  }

  try {
    const [orderRows, balanceRows, billRows, paymentRows, projectRows, vendorRows, categoryRows, expenseCategoryRows, officeCategoryRows] =
      await Promise.all([
        fetchPages((from, to) =>
          supabase
            .from("vendor_purchase_orders")
            .select(
              "id, issued_on, notes, project_id, vendor_id, work_type, total_value, expense_category_id, office_expense_category_id",
            )
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchPages((from, to) =>
          supabase
            .from("vendor_po_balances")
            .select("purchase_order_id, total_paid")
            .order("purchase_order_id", { ascending: true })
            .range(from, to),
        ),
        fetchPages((from, to) =>
          supabase
            .from("vendor_invoices")
            .select("id, purchase_order_id, amount, status")
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchPages((from, to) =>
          supabase
            .from("vendor_payments")
            .select("vendor_invoice_id, amount")
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchPages((from, to) =>
          supabase
            .from("projects")
            .select("id, name")
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchPages((from, to) =>
          supabase
            .from("vendor_summaries")
            .select("vendor_id, display_name")
            .order("vendor_id", { ascending: true })
            .range(from, to),
        ),
        fetchPages((from, to) =>
          supabase
            .from("vendor_work_categories")
            .select("name, sort_order")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        ),
        fetchPages((from, to) =>
          supabase
            .from("project_expense_categories")
            .select("id, name, sort_order")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        ),
        fetchPages((from, to) =>
          supabase
            .from("office_expense_categories")
            .select("id, name, sort_order")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        ),
      ])

    const projects = projectRows
      .map((row) => ({
        id: row.id,
        name: row.name?.trim() ?? "",
      }))
      .sort(byLabel)

    const vendors = vendorRows
      .flatMap((row) => {
        if (!row.vendor_id) {
          return []
        }

        return [
          {
            id: row.vendor_id,
            displayName: row.display_name?.trim() ?? "",
          } satisfies VendorOption,
        ]
      })
      .sort((left, right) =>
        byLabel(
          { id: left.id, name: left.displayName },
          { id: right.id, name: right.displayName },
        ),
      )

    const expenseCategories = expenseCategoryRows.flatMap((row) => {
      const name = row.name?.trim() ?? ""
      if (!name) return []
      return [{ id: row.id, name } satisfies ExpenseCategoryOption]
    })
    const expenseCategoryNames = new Map(
      expenseCategories.map((category) => [category.id, category.name]),
    )
    const officeExpenseCategories = officeCategoryRows.flatMap((row) => {
      const name = row.name?.trim() ?? ""
      if (!name) return []
      return [{ id: row.id, name } satisfies ExpenseCategoryOption]
    })
    const officeCategoryNames = new Map(
      officeExpenseCategories.map((category) => [category.id, category.name]),
    )

    const projectsById = new Map(projects.map((project) => [project.id, project]))
    const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]))
    const balancesById = new Map(
      balanceRows.flatMap((row) =>
        row.purchase_order_id ? [[row.purchase_order_id, row] as const] : [],
      ),
    )
    const pendingByPo = openPayableByPurchaseOrder(
      billRows.map((bill) => ({
        id: bill.id,
        purchaseOrderId: bill.purchase_order_id,
        amount: toNumber(bill.amount),
        status: bill.status,
      })),
      paymentRows.map((payment) => ({
        billId: payment.vendor_invoice_id,
        amount: toNumber(payment.amount),
      })),
    )

    const orders = orderRows.map((row) => {
      const balance = balancesById.get(row.id)
      const project = row.project_id ? projectsById.get(row.project_id) : undefined
      const vendor = vendorsById.get(row.vendor_id)

      return {
        id: row.id,
        issuedOn: dateInputValue(row.issued_on),
        projectId: row.project_id,
        projectName: project?.name ?? "",
        vendorId: row.vendor_id,
        vendorName: vendor?.displayName ?? "",
        workType: row.work_type?.trim() ?? "",
        expenseCategoryId: row.expense_category_id ?? "",
        expenseCategoryName: row.expense_category_id
          ? (expenseCategoryNames.get(row.expense_category_id) ?? "")
          : "",
        officeExpenseCategoryId: row.office_expense_category_id ?? "",
        officeExpenseCategoryName: row.office_expense_category_id
          ? (officeCategoryNames.get(row.office_expense_category_id) ?? "")
          : "",
        totalValue: toNumber(row.total_value),
        totalPaid: toNumber(balance?.total_paid),
        totalPending: pendingByPo.get(row.id) ?? 0,
        notes: row.notes ?? "",
      } satisfies PurchaseOrderRow
    })

    const workTypes = mergeCategorySuggestions(
      categoryRows.map((row) => row.name),
      orders.map((order) => order.workType),
    )

    const requestedId =
      projectId && idPattern.test(projectId) ? projectId : null
    const matchedProject = requestedId
      ? projectsById.get(requestedId) ?? null
      : null

    if (requestedId && !matchedProject) {
      return {
        orders: [],
        projects,
        vendors,
        workTypes,
        expenseCategories,
        officeExpenseCategories,
        projectFilter: null,
        error: "That project could not be found.",
      }
    }

    return {
      orders: matchedProject
        ? orders.filter(
            (order) =>
              order.projectId == null || order.projectId === matchedProject.id,
          )
        : orders,
      projects,
      vendors,
      workTypes,
      expenseCategories,
      officeExpenseCategories,
      projectFilter: matchedProject
        ? { id: matchedProject.id, name: matchedProject.name }
        : null,
      error: null,
    }
  } catch {
    return empty
  }
}

function byLabel(a: ProjectOption, b: ProjectOption): number {
  const byName = a.name.localeCompare(b.name, "en", { sensitivity: "base" })
  if (byName !== 0) {
    return byName
  }

  return a.id.localeCompare(b.id)
}

async function fetchPages<T>(
  queryPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: { message: string } | null
  }>,
): Promise<T[]> {
  const rows: T[] = []

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE
    const { data, error } = await queryPage(from, from + PAGE_SIZE - 1)

    if (error) {
      throw error
    }

    const batch = data ?? []
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) {
      return rows
    }
  }

  throw new Error("Purchase order list is larger than expected.")
}
