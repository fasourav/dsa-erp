"use client"

import Link from "next/link"
import { useState, useTransition } from "react"

import { clearSignature, stampSignature } from "@/app/(app)/documents/signature-actions"
import { useAccess } from "@/components/access-provider"
import { Button } from "@/components/ui/button"
import { isSignatureEnabled } from "@/lib/documents/drafts"
import {
  canClearStamp,
  canStampSlot,
  slotLabel,
  stampSlots,
  type SignatureStamps,
  type StampKind,
  type StampSlot,
} from "@/lib/documents/signature-stamps"

export type StampChange = {
  slot: StampSlot
  stamps: SignatureStamps
  name: string
  imageUrl: string | null
}

export function SignatureStampPanel({
  kind,
  id,
  stamps,
  names,
  blockedReason,
  onChange,
}: {
  kind: StampKind
  id: string | null
  stamps: SignatureStamps
  names: Record<StampSlot, string>
  blockedReason: string | null
  onChange: (change: StampChange) => void
}) {
  const access = useAccess()
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const slots = stampSlots.filter((slot) => isSignatureEnabled(names[slot]))
  if (!slots.length) return null
  const hasSignature = Boolean(access.signaturePath)

  const run = (slot: StampSlot, action: typeof stampSignature) => {
    if (!id) return
    start(async () => {
      setError(null)
      const result = await action({ kind, id, slot })
      if (result.error !== null) setError(result.error)
      else onChange({ slot, stamps: result.stamps, name: result.name, imageUrl: result.imageUrl })
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="text-sm font-semibold">Digital Signatures</p>
      {slots.map((slot) => {
        const stamp = stamps[slot]
        return (
          <div key={slot} className="flex items-center justify-between gap-2 text-sm">
            <span>
              {slotLabel[slot]}
              <span className="text-muted-foreground"> · {stamp ? `Signed by ${stamp.name}` : "Not signed"}</span>
            </span>
            <span className="flex gap-2">
              {!stamp && canStampSlot(access.role, slot) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending || !hasSignature || Boolean(blockedReason) || !id}
                  onClick={() => run(slot, stampSignature)}
                >
                  Place Signature
                </Button>
              ) : null}
              {stamp &&
              canClearStamp({ role: access.role, isOwner: access.isOwner, userId: access.userId, stamp }) ? (
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(slot, clearSignature)}>
                  Clear Signature
                </Button>
              ) : null}
            </span>
          </div>
        )
      })}
      {!hasSignature ? (
        <p className="text-xs text-muted-foreground">
          Add your signature on{" "}
          <Link href="/profile" className="underline">
            My Profile
          </Link>{" "}
          to sign documents.
        </p>
      ) : blockedReason ? (
        <p className="text-xs text-muted-foreground">{blockedReason}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
