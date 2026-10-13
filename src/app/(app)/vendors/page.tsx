import { getVendors } from "@/lib/vendors"
import { VendorsTable } from "./vendors-table"
import { requireModule } from "@/lib/permissions"
import { firstParam } from "@/lib/search"

export const metadata = { title: "Vendors" }

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  await requireModule("vendors")
  const params = await searchParams
  const { vendors, categories, error } = await getVendors()
  const initialQuery = firstParam(params.q)

  return (
    <VendorsTable
      key={initialQuery || "all"}
      vendors={vendors}
      categories={categories}
      error={error}
      initialQuery={initialQuery}
    />
  )
}
