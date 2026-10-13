import { AssetsTable } from "@/app/(app)/assets/assets-table"
import { getAssets } from "@/lib/assets"
import { requireModule } from "@/lib/permissions"
import { firstParam } from "@/lib/search"

export const metadata = { title: "Assets" }

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  await requireModule("assets")
  const params = await searchParams
  const { assets, categories, error } = await getAssets()
  const initialQuery = firstParam(params.q)

  return (
    <AssetsTable
      key={initialQuery || "all"}
      assets={assets}
      categories={categories}
      error={error}
      initialQuery={initialQuery}
    />
  )
}
