import { parseProjectValue } from "@/lib/project-validation"

export const paymentStatuses = ["unpaid", "partial", "paid", "void"] as const

export type PaymentStatus = (typeof paymentStatuses)[number]

export function isPaymentStatus(value: string): value is PaymentStatus {
  return paymentStatuses.includes(value as PaymentStatus)
}

export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case "unpaid":
      return "Unpaid"
    case "partial":
      return "Partial"
    case "paid":
      return "Paid"
    case "void":
      return "Void"
  }
}

export function moneyCents(value: number): number {
  return Math.round(value * 100)
}

export function derivePaymentStatus(amount: number, paid: number): PaymentStatus {
  const amountCents = moneyCents(amount)
  const paidCents = moneyCents(paid)

  if (paidCents <= 0) {
    return "unpaid"
  }

  if (paidCents >= amountCents) {
    return "paid"
  }

  return "partial"
}

export function statusMatchesPayments(
  status: PaymentStatus,
  amount: number,
  paid: number,
): boolean {
  if (status === "void") {
    return true
  }

  return status === derivePaymentStatus(amount, paid)
}

export function sumAmounts(amounts: readonly number[]): number {
  return amounts.reduce((total, amount) => total + moneyCents(amount), 0) / 100
}

export function parsePositiveAmount(value: string): number | null {
  const parsed = parseProjectValue(value)
  if (parsed === null || parsed <= 0) {
    return null
  }

  return parsed
}
