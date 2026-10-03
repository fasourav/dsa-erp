import { ClientsTable } from "./clients-table"
import { getClientSummaries } from "@/lib/clients"

export const metadata = { title: "Clients" }

export default async function ClientsPage() {
  const { clients, error } = await getClientSummaries()

  return <ClientsTable clients={clients} error={error} />
}
