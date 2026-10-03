"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ClientSummary } from "@/lib/client-summary"
import { cn } from "@/lib/utils"

const NOT_AVAILABLE = "Not Available!"

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
    { label: "Contact Name", value: contactName, fallback: "" },
    { label: "Email", value: client?.email?.trim() ?? "", fallback: NOT_AVAILABLE },
    { label: "Number", value: client?.phone?.trim() ?? "", fallback: NOT_AVAILABLE },
    { label: "Notes", value: client?.notes?.trim() ?? "", fallback: NOT_AVAILABLE },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="break-words">
            {client?.displayName ?? ""}
          </DialogTitle>
        </DialogHeader>
        <dl className="flex flex-col gap-4">
          {fields.map((field) => (
            <div key={field.label} className="flex flex-col gap-1">
              <dt className="text-sm text-muted-foreground">{field.label}</dt>
              <dd
                className={cn(
                  "min-h-5 text-sm font-medium break-words whitespace-pre-wrap",
                  !field.value && "text-muted-foreground"
                )}
              >
                {field.value || field.fallback}
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
