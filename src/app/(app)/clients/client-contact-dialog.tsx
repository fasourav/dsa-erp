"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ClientSummary } from "@/lib/client-summary"

export function ClientContactDialog({
  client,
  open,
  onOpenChange,
}: {
  client: ClientSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const contactName =
    client?.kind === "company" && client.personName?.trim()
      ? client.personName.trim()
      : ""

  const fields = [
    { label: "Client Name", value: client?.displayName ?? "" },
    { label: "Contact Name", value: contactName },
    { label: "Email", value: client?.email?.trim() ?? "" },
    { label: "Notes", value: client?.notes?.trim() ?? "" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Contact card</DialogTitle>
          <DialogDescription>Contact details for this client.</DialogDescription>
        </DialogHeader>
        <dl className="flex flex-col gap-4">
          {fields.map((field) => (
            <div key={field.label} className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">{field.label}</dt>
              <dd className="min-h-5 text-sm font-medium break-words whitespace-pre-wrap">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
