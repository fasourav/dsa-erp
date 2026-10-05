import { toNumber } from "@/lib/format"
import { dateInputValue } from "@/lib/project-validation"
import {
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
  projectFilter: ProjectFilter | null
  error: string | null
}> {
  const supabase = await createClient()
  const empty = {
    orders: [] as PurchaseOrderRow[],
    projects: [] as ProjectOption[],
    vendors: [] as VendorOption[],
    workTypes: [] as string[],
    projectFilter: null,
    error: "Could not load purchase orders.",
  }

  try {
    const [orderRows, balanceRows, projectRows, vendorRows, categoryRows] =
      await Promise.all([
        fetchPages((from, to) =>
          supabase
            .from("vendor_purchase_orders")
            .select(
              "id, issued_on, notes, project_id, vendor_id, work_type, total_value",
            )
            .order("id", { ascending: true })
            .range(from, to),
        ),
        fetchPages((from, to) =>
          supabase
            .from("vendor_po_balances")
            .select("purchase_order_id, total_paid, total_pending")
            .order("purchase_order_id", { ascending: true })
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

    const projectsById = new Map(projects.map((project) => [project.id, project]))
    const vendorsById = new Map(vendors.map((vendor) => [vendor.id, vendor]))
    const balancesById = new Map(
      balanceRows.flatMap((row) =>
        row.purchase_order_id ? [[row.purchase_order_id, row] as const] : [],
      ),
    )

    const orders = orderRows.map((row) => {
      const balance = balancesById.get(row.id)
      const project = projectsById.get(row.project_id)
      const vendor = vendorsById.get(row.vendor_id)

      return {
        id: row.id,
        issuedOn: dateInputValue(row.issued_on),
        projectId: row.project_id,
        projectName: project?.name ?? "",
        vendorId: row.vendor_id,
        vendorName: vendor?.displayName ?? "",
        workType: row.work_type?.trim() ?? "",
        totalValue: toNumber(row.total_value),
        totalPaid: toNumber(balance?.total_paid),
        totalPending: toNumber(balance?.total_pending),
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
        projectFilter: null,
        error: "That project could not be found.",
      }
    }

    return {
      orders: matchedProject
        ? orders.filter((order) => order.projectId === matchedProject.id)
        : orders,
      projects,
      vendors,
      workTypes,
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
