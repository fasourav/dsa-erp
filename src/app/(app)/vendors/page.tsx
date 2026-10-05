import { getVendors } from "@/lib/vendors"
import { VendorsTable } from "./vendors-table"

export const metadata = { title: "Vendors" }

export default async function VendorsPage() {
  const { vendors, categories, error } = await getVendors()

  return (
    <VendorsTable vendors={vendors} categories={categories} error={error} />
  )
}
