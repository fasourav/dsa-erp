import { AssetsTable } from "@/app/(app)/assets/assets-table"
import { getAssets } from "@/lib/assets"

export const metadata = { title: "Assets" }

export default async function AssetsPage() {
  const { assets, error } = await getAssets()

  return <AssetsTable assets={assets} error={error} />
}
