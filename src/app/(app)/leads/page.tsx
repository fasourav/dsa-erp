import { LeadsTable } from "@/app/(app)/leads/leads-table"
import { getLeads } from "@/lib/leads"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Leads" }

export default async function LeadsPage() {
  await requireModule("leads")
  const { leads, lookups, error } = await getLeads()

  return <LeadsTable leads={leads} lookups={lookups} error={error} />
}
