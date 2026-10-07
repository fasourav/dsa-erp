"use client"

import type { ReactNode } from "react"

import { MailtoLink, TelLink } from "@/components/contact-links"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { VendorSummary } from "@/lib/vendor-summary"
import { cn } from "@/lib/utils"

const NOT_AVAILABLE = "Not Available!"

export function VendorContactDialog({
  vendor,
  open,
  onOpenChange,
}: {
  vendor: VendorSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const address = vendor?.address?.trim() ?? ""
  const phone = vendor?.phone?.trim() ?? ""
  const email = vendor?.email?.trim() ?? ""
  const notes = vendor?.notes?.trim() ?? ""

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="break-words">
            {vendor?.displayName ?? ""}
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
