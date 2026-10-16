import { PageHeader } from "@/components/page-header"
import { listTrashedDocuments } from "@/lib/documents/queries"
import { requireOwner } from "@/lib/permissions"

import { TrashPanel } from "./trash-panel"

export const metadata = { title: "Trash" }

export default async function DocumentTrashPage() {
  await requireOwner()
  const page = await listTrashedDocuments()

  return (
    <div className="flex w-full min-w-0 flex-col gap-3.5">
      <PageHeader
        title="Trash"
        description="Restore a document, or delete it forever. Only owners can see this list."
      />
      {page.error ? (
        <p role="alert" className="text-sm text-destructive">
          {page.error}
        </p>
      ) : null}
      <TrashPanel items={page.items} />
    </div>
  )
}
