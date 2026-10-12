import { getVendors } from "@/lib/vendors"
import { VendorsTable } from "./vendors-table"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Vendors" }

export default async function VendorsPage() {
  await requireModule("vendors")
  const { vendors, categories, error } = await getVendors()

  return (
    <VendorsTable vendors={vendors} categories={categories} error={error} />
  )
}
