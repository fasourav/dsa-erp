import { moneyCents } from "@/lib/payment-status"

/**
 * Bill-based open payable. Unbilled purchase-order value is a commitment, not a payable.
 *
 * Per non-void bill: max(amount − payments on that bill, 0). Then sum.
 * An overpayment on one bill does not reduce another. A void bill contributes 0.
 *
 * Worked cases:
 * - openPayableForBill(100000, 100000, "paid") === 0
 * - openPayableForBill(200000, 0, "unpaid") === 200000
 * - openPayableForBill(100000, 0, "void") === 0
 * - bills 100000 paid in full and 200000 unpaid → 200000, not the purchase-order remainder
 * - bill 100000 paid 150000 plus bill 50000 unpaid → 50000
 */
export type PayableBill = {
  id: string
  amount: number
  status: string
}

export function openPayableForBill(
  amount: number,
  paid: number,
  status: string,
): number {
  if (status === "void") {
    return 0
  }

  const open = moneyCents(amount) - moneyCents(paid)
  return open > 0 ? open / 100 : 0
}

export function paidByBillId(
  payments: readonly { billId: string | null; amount: number }[],
): Map<string, number> {
  const paid = new Map<string, number>()

  for (const payment of payments) {
    if (!payment.billId) {
      continue
    }

    const current = paid.get(payment.billId) ?? 0
    paid.set(
      payment.billId,
      (moneyCents(current) + moneyCents(payment.amount)) / 100,
    )
  }

  return paid
}

export function sumOpenPayable(
  bills: readonly PayableBill[],
  paidByBillId: ReadonlyMap<string, number>,
): number {
  const cents = bills.reduce((total, bill) => {
    return (
      total +
      moneyCents(
        openPayableForBill(
          bill.amount,
          paidByBillId.get(bill.id) ?? 0,
          bill.status,
        ),
      )
    )
  }, 0)

  return cents / 100
}

export function openPayableByPurchaseOrder(
  bills: readonly (PayableBill & { purchaseOrderId: string | null })[],
  payments: readonly { billId: string | null; amount: number }[],
): Map<string, number> {
  const paid = paidByBillId(payments)
  const grouped = new Map<string, PayableBill[]>()

  for (const bill of bills) {
    if (!bill.purchaseOrderId) {
      continue
    }

    const group = grouped.get(bill.purchaseOrderId) ?? []
    group.push({ id: bill.id, amount: bill.amount, status: bill.status })
    grouped.set(bill.purchaseOrderId, group)
  }

  const pending = new Map<string, number>()
  for (const [purchaseOrderId, group] of grouped) {
    pending.set(purchaseOrderId, sumOpenPayable(group, paid))
  }

  return pending
}
