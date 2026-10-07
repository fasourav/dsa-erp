import { LeadsTable } from "@/app/(app)/leads/leads-table"
import { getLeads } from "@/lib/leads"

export const metadata = { title: "Leads" }

export default async function LeadsPage() {
  const { leads, lookups, error } = await getLeads()

  return <LeadsTable leads={leads} lookups={lookups} error={error} />
}
