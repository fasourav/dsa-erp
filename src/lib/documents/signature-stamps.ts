// Pure: no "@/..." imports so node --test can load it.

export const stampSlots = ["prepared", "checked", "authorized"] as const
export type StampSlot = (typeof stampSlots)[number]

export const stampKinds = ["quotation", "work_order", "invoice", "receipt", "purchase_order"] as const
export type StampKind = (typeof stampKinds)[number]

export type SignatureStamp = {
  imagePath: string
  name: string
  designation: string
  signedByUserId: string
  signedAt: string
}

export type SignatureStamps = Partial<Record<StampSlot, SignatureStamp>>

/** Mirrors SIGNATURE_OFF in src/lib/documents/drafts.ts */
export const SIGNATURE_OFF_VALUE = "__off__"

export const STAMP_PREFIX = "document-signatures/"

export const slotLabel: Record<StampSlot, string> = {
  prepared: "Prepared By",
  checked: "Checked By",
  authorized: "Authorized Signature",
}

export const isStampSlot = (value: unknown): value is StampSlot =>
  typeof value === "string" && (stampSlots as readonly string[]).includes(value)

export const isStampKind = (value: unknown): value is StampKind =>
  typeof value === "string" && (stampKinds as readonly string[]).includes(value)

export function canStampSlot(role: string, slot: StampSlot): boolean {
  return role === "owner" ? slot === "authorized" : slot === "prepared" || slot === "checked"
}

export function canClearStamp(input: {
  role: string
  isOwner: boolean
  userId: string
  stamp: SignatureStamp | undefined
}): boolean {
  return Boolean(input.stamp) && (input.isOwner || input.stamp!.signedByUserId === input.userId)
}

export function parseStamps(value: unknown): SignatureStamps {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  const out: SignatureStamps = {}
  for (const slot of stampSlots) {
    const entry = (value as Record<string, unknown>)[slot]
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
    const record = entry as Record<string, unknown>
    const text = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : null)
    const imagePath = text("imagePath")
    const name = text("name")
    const signedByUserId = text("signedByUserId")
    const signedAt = text("signedAt")
    if (
      !imagePath ||
      !imagePath.startsWith(STAMP_PREFIX) ||
      imagePath.includes("..") ||
      !name ||
      !signedByUserId ||
      !signedAt
    ) {
      continue
    }
    out[slot] = {
      imagePath,
      name,
      designation: text("designation") ?? "",
      signedByUserId,
      signedAt,
    }
  }
  return out
}

export function reconcileStamps(stamps: SignatureStamps, names: Record<StampSlot, string>): SignatureStamps {
  const out: SignatureStamps = {}
  for (const slot of stampSlots) {
    const stamp = stamps[slot]
    const name = names[slot]
    if (stamp && name !== SIGNATURE_OFF_VALUE && name.trim() === stamp.name.trim()) out[slot] = stamp
  }
  return out
}

export const stampObjectPath = (kind: StampKind, id: string, slot: StampSlot) =>
  `${STAMP_PREFIX}${kind}/${id}/${slot}.png`
