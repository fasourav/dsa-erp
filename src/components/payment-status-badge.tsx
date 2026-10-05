import { Badge } from "@/components/ui/badge"
import {
  paymentStatusLabel,
  type PaymentStatus,
} from "@/lib/payment-status"
import { cn } from "@/lib/utils"

const pillClassName = "h-7 gap-1.5 rounded-full px-2.5 text-sm font-medium"

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="secondary" className={cn(pillClassName, statusClassName(status))}>
      {paymentStatusLabel(status)}
    </Badge>
  )
}

function statusClassName(status: PaymentStatus): string {
  switch (status) {
    case "unpaid":
      return "bg-muted text-muted-foreground"
    case "partial":
      return "bg-secondary text-secondary-foreground"
    case "paid":
      return "bg-primary/10 text-primary"
    case "void":
      return "bg-destructive/10 text-destructive"
  }
}
