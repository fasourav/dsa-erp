import Link from "next/link"

import { DocumentList } from "@/components/documents/document-list"
import { Button } from "@/components/ui/button"
import { allows } from "@/lib/access"
import { listWorkOrders } from "@/lib/documents/queries"
import { getAccess, requireModule } from "@/lib/permissions"

export const metadata = { title: "Work orders" }

export default async function WorkOrdersPage() {
  await requireModule("work_orders")
  const [page, access] = await Promise.all([listWorkOrders(), getAccess()])
  const canAdd = access ? allows(access, "work_orders", "add") : false

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-tight">Work orders</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Orders issued to vendors and service providers.
          </p>
        </div>
        {canAdd ? (
          <Button type="button" className="w-full sm:w-fit" render={<Link href="/documents/work-orders/new" />}>
            New work order
          </Button>
        ) : null}
      </div>
      {page.error ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error}
        </p>
      ) : null}
      <DocumentList
        items={page.items}
        hrefBase="/documents/work-orders"
        empty="No work orders yet."
      />
    </div>
  )
}
