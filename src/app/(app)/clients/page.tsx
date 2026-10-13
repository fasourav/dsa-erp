import { ClientsTable } from "./clients-table"
import { getClientSummaries } from "@/lib/clients"
import { requireModule } from "@/lib/permissions"
import { firstParam } from "@/lib/search"

export const metadata = { title: "Clients" }

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  await requireModule("clients")
  const params = await searchParams
  const { clients, error } = await getClientSummaries()
  const initialQuery = firstParam(params.q)

  return <ClientsTable key={initialQuery || "all"} clients={clients} error={error} initialQuery={initialQuery} />
}
