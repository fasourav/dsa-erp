"use client"

import type { ReactNode } from "react"

import { MailtoLink, TelLink } from "@/components/contact-links"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatPhoneDisplay } from "@/lib/phone"
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
  const address = client?.address?.trim() ?? ""
  const phone = formatPhoneDisplay(client?.phone ?? "")
  const email = client?.email?.trim() ?? ""
  const notes = client?.notes?.trim() ?? ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="break-words">
            {client?.displayName ?? ""}
          </DialogTitle>
        </DialogHeader>
        <dl className="flex flex-col gap-4">
          <Field label="Address" empty={!address}>
            {address || NOT_AVAILABLE}
          </Field>
          <Field label="Contact Number" empty={!phone}>
            {phone ? <TelLink phone={phone} /> : NOT_AVAILABLE}
          </Field>
          <Field label="Email" empty={!email}>
            {email ? <MailtoLink email={email} /> : NOT_AVAILABLE}
          </Field>
          <Field label="Notes" empty={!notes}>
            {notes || NOT_AVAILABLE}
          </Field>
        </dl>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  empty,
  children,
}: {
  label: string
  empty: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-h-5 text-sm font-medium break-words whitespace-pre-wrap",
          empty && "text-muted-foreground",
        )}
      >
        {children}
      </dd>
    </div>
  )
}
