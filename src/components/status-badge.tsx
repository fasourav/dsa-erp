import { Badge } from "@/components/ui/badge"
import {
  isPaymentStatus,
  moneyCents,
  paymentStatusLabel,
} from "@/lib/payment-status"
import { cn } from "@/lib/utils"

const pillClassName =
  "h-7 gap-1.5 rounded-full border-transparent px-2.5 text-sm font-medium"

const toneClassName = {
  paid: "bg-primary text-primary-foreground",
  pending: "bg-status-pending text-status-pending-foreground",
  unpaid: "bg-status-unpaid text-status-unpaid-foreground",
  active: "bg-primary text-primary-foreground",
  completed: "bg-status-completed text-status-completed-foreground",
  neutral: "bg-secondary text-secondary-foreground",
} as const

type StatusTone = keyof typeof toneClassName

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
    <Badge variant="secondary" className={cn(pillClassName, toneClassName[tone])}>
      {tone === "paid" ? (
        <span
          aria-hidden="true"
          className="size-2 rounded-full bg-primary-foreground"
        />
      ) : null}
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
