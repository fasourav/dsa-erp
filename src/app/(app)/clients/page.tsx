import { ClientsTable } from "./clients-table"
import { getClientSummaries } from "@/lib/clients"
import { requireModule } from "@/lib/permissions"

export const metadata = { title: "Clients" }

export default async function ClientsPage() {
  await requireModule("clients")
  const { clients, error } = await getClientSummaries()

  return <ClientsTable clients={clients} error={error} />
}
