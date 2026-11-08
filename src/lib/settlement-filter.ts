import { dateInputValue } from "@/lib/project-validation"
import { openPayableForBill } from "@/lib/open-payable"

/**
 * Outstanding / Settled / All for Accounts Payable, Accounts Receivable,
 * and Client Invoices.
 *
 * Outstanding = a positive open balance. Settled = zero open balance.
 * A partial payment stays Outstanding. Void is never Settled and never
 * Outstanding: payable totals already skip void bills, the receivable view
 * drops void invoices, and the invoice list keeps excluding them from All.
 *
 * A null settlement means the balance was withheld (financial figures
 * hidden). It must not be read as Settled. Those rows stay in every filter
 * and in every count so the control does not invent a split from masked
 * zeros or reveal which rows are open.
 */
export const settlementFilters = ["outstanding", "settled", "all"] as const

export type SettlementFilter = (typeof settlementFilters)[number]

export type RowSettlement = "outstanding" | "settled"

export type SettlementCounts = Record<SettlementFilter, number>

export function parseSettlementFilter(
  raw: string | string[] | undefined,
): SettlementFilter {
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? ""
  if (value === "settled" || value === "all" || value === "outstanding") {
    return value
  }
  return "outstanding"
}

/** Omit the default so a refresh with no query is Outstanding. */
export function settlementQueryValue(filter: SettlementFilter): string | null {
  return filter === "outstanding" ? null : filter
}

export function matchesSettlement(
  settlement: RowSettlement | null,
  filter: SettlementFilter,
): boolean {
  if (settlement === null || filter === "all") {
    return true
  }
  return settlement === filter
}

export function settlementCounts<T>(
  rows: readonly T[],
  settlementOf: (row: T) => RowSettlement | null,
): SettlementCounts {
  let outstanding = 0
  let settled = 0
  let withheld = 0

  for (const row of rows) {
    const settlement = settlementOf(row)
    if (settlement === "outstanding") {
      outstanding += 1
    } else if (settlement === "settled") {
      settled += 1
    } else {
      withheld += 1
    }
  }

  return {
    outstanding: outstanding + withheld,
    settled: settled + withheld,
    all: outstanding + settled + withheld,
  }
}

/**
 * Balance wins when it is present. A hidden balance is null, never the
 * masked zero. Status is only a fallback for that hidden case, and void
 * still does not count as Settled.
 */
export function settlementFromBalance(
  outstanding: number | null,
  status: string | null,
): RowSettlement | null {
  if (outstanding !== null && Number.isFinite(outstanding)) {
    return outstanding > 0 ? "outstanding" : "settled"
  }
  if (status === "unpaid" || status === "partial") {
    return "outstanding"
  }
  if (status === "paid") {
    return "settled"
  }
  return null
}

export type OpenBillDateInput = {
  amount: number
  paid: number
  status: string
  issuedOn: string
}

/**
 * Earliest business bill date (`issued_on`, date only) among non-void bills
 * with a positive open balance. Fully paid and void bills do not contribute.
 * Missing or non-ISO dates are skipped rather than invented. Equal dates tie.
 */
export function oldestUnpaidBillDate(
  bills: readonly OpenBillDateInput[],
): string | null {
  let oldest: string | null = null

  for (const bill of bills) {
    if (openPayableForBill(bill.amount, bill.paid, bill.status) <= 0) {
      continue
    }
    const issuedOn = dateInputValue(bill.issuedOn)
    if (!issuedOn) {
      continue
    }
    if (oldest === null || issuedOn < oldest) {
      oldest = issuedOn
    }
  }

  return oldest
}

/** Chronological ISO dates. Null stays last in both directions. */
export function compareIsoDateNullLast(
  left: string | null,
  right: string | null,
  direction: "asc" | "desc",
): number {
  if (left === null && right === null) {
    return 0
  }
  if (left === null) {
    return 1
  }
  if (right === null) {
    return -1
  }
  const order = left.localeCompare(right)
  return direction === "asc" ? order : -order
}
