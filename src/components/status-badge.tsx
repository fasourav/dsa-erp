import { Badge } from "@/components/ui/badge"
import {
  isPaymentStatus,
  moneyCents,
  paymentStatusLabel,
} from "@/lib/payment-status"

const toneVariant = {
  paid: "success",
  pending: "warning",
  unpaid: "destructive",
  active: "info",
  completed: "success",
  neutral: "neutral",
} as const

type StatusTone = keyof typeof toneVariant

export function paymentBalanceStatus(
  paid: number,
  pending: number,
): "paid" | "partial" | "unpaid" {
  if (moneyCents(pending) <= 0) {
    return "paid"
  }

  if (moneyCents(paid) <= 0) {
    return "unpaid"
  }

  return "partial"
}

export function StatusBadge({ status }: { status: string }) {
  const tone = statusTone(status)

  return (
    <Badge variant={toneVariant[tone]}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {statusText(status)}
    </Badge>
  )
}

function statusTone(status: string): StatusTone {
  switch (status.trim().toLowerCase()) {
    case "paid":
      return "paid"
    case "pending":
    case "partial":
      return "pending"
    case "unpaid":
      return "unpaid"
    case "active":
      return "active"
    case "completed":
      return "completed"
    default:
      return "neutral"
  }
}

function statusText(status: string): string {
  const key = status.trim().toLowerCase()

  if (isPaymentStatus(key)) {
    return paymentStatusLabel(key)
  }

  if (key === "pending") {
    return "Pending"
  }

  return key
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}
