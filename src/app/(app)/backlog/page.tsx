import { BacklogTable } from "@/app/(app)/backlog/backlog-table"
import { getBacklog } from "@/lib/backlog-data"

export const metadata = { title: "Backlog" }

export default async function BacklogPage() {
  const page = await getBacklog()

  return <BacklogTable rows={page.rows} error={page.error} />
}
