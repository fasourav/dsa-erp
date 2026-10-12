import { AssetsTable } from "@/app/(app)/assets/assets-table"
import { getAssets } from "@/lib/assets"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Assets" }

export default async function AssetsPage() {
  await requireModule("assets")
  const { assets, categories, error } = await getAssets()

  return <AssetsTable assets={assets} categories={categories} error={error} />
}
