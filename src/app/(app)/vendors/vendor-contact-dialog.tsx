"use client"

import type { ReactNode } from "react"

import { MailtoLink, TelLink } from "@/components/contact-links"
import {
  Dialog,
  DialogBody,
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
      <DialogContent className="overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="break-words">
            {vendor?.displayName ?? ""}
          </DialogTitle>
        </DialogHeader>
        <DialogBody>
          <dl className="flex flex-col">
            <ContactField label="Address" empty={!address}>
              {address || NOT_AVAILABLE}
            </ContactField>
            <ContactField label="Contact Number" empty={!phone}>
              {phone ? <TelLink phone={phone} /> : NOT_AVAILABLE}
            </ContactField>
            <ContactField label="Email" empty={!email}>
              {email ? <MailtoLink email={email} /> : NOT_AVAILABLE}
            </ContactField>
            <ContactField label="Notes" empty={!notes}>
              {notes || NOT_AVAILABLE}
            </ContactField>
          </dl>
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function ContactField({
  label,
  empty,
  children,
}: {
  label: string
  empty: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 first:pt-0">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "min-h-5 text-ui font-semibold break-words whitespace-pre-wrap",
          empty && "font-book text-muted-foreground",
        )}
      >
        {children}
      </dd>
    </div>
  )
}
