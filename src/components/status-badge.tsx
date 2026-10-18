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
  totalValue = 0,
): "paid" | "partial" | "unpaid" {
  if (moneyCents(paid) <= 0) {
    return "unpaid"
  }

  if (moneyCents(pending) > 0 || moneyCents(paid) < moneyCents(totalValue)) {
    return "partial"
  }

  return "paid"
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
  switch (status.trim().toLowerCase().replace(/[_-]+/g, " ")) {
    case "paid":
    case "won":
    case "inflow":
      return "paid"
    case "pending":
    case "partial":
    case "on hold":
    case "invited":
      return "pending"
    case "unpaid":
    case "lost":
    case "outflow":
      return "unpaid"
    case "active":
    case "open":
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
