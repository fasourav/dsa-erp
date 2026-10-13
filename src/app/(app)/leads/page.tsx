import { LeadsTable } from "@/app/(app)/leads/leads-table"
import { getLeads } from "@/lib/leads"
import { requireModule } from "@/lib/permissions"
import { firstParam } from "@/lib/search"

export const metadata = { title: "Leads" }

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  await requireModule("leads")
  const params = await searchParams
  const { leads, lookups, error } = await getLeads()
  const initialQuery = firstParam(params.q)

  return (
    <LeadsTable
      key={initialQuery || "all"}
      leads={leads}
      lookups={lookups}
      error={error}
      initialQuery={initialQuery}
    />
  )
}
