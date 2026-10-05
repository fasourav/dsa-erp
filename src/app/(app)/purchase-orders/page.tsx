import { PurchaseOrdersTable } from "./purchase-orders-table"
import { getPurchaseOrders } from "@/lib/purchase-orders"

export const metadata = { title: "Purchase Orders" }

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>
}) {
  const params = await searchParams
  const projectParam = Array.isArray(params.project)
    ? params.project[0]
    : params.project
  const {
    orders,
    projects,
    vendors,
    workTypes,
    projectFilter,
    error,
  } = await getPurchaseOrders(projectParam ?? null)

  return (
    <PurchaseOrdersTable
      key={projectFilter?.id ?? "all"}
      orders={orders}
      projects={projects}
      vendors={vendors}
      workTypes={workTypes}
      projectFilter={projectFilter}
      error={error}
    />
  )
}
