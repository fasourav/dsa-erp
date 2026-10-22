import type { SupabaseClient } from "@supabase/supabase-js"

import { toNumber } from "@/lib/format"
import { moneyCents } from "@/lib/payment-status"
import type { Database } from "@/types/database.types"

type Db = SupabaseClient<Database>

export type DuplicateMatch = {
  kind: "Operational Expense" | "Vendor Payment"
  date: string
  amount: number
  label: string
}

export type DuplicateDecision =
  | { status: "error"; error: string }
  | { status: "blocked"; matches: DuplicateMatch[]; reasonError: string }
  | { status: "ok"; notes: string }

const matchLimit = 20

export function shiftIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function notesWithDuplicateOverride(notes: string, reason: string): string {
  const line = `Duplicate override: ${reason}`
  if (notes === line || notes.startsWith(`${line}\n`)) return notes
  return notes ? `${line}\n${notes}` : line
}

export async function resolveDuplicateNotes(
  supabase: Db,
  input: {
    amount: number
    bankAccountId: string
    date: string
    notes: string
    confirmNotDuplicate: boolean
    duplicateReason: string
    exceptExpenseId: string | null
    exceptPaymentId: string | null
  },
): Promise<DuplicateDecision> {
  const from = shiftIsoDate(input.date, -7)
  const to = shiftIsoDate(input.date, 7)
  const wanted = moneyCents(input.amount)

  const [expenses, payments] = await Promise.all([
    supabase
      .from("operational_expenses")
      .select("id, expense_date, amount, category, vendors(person_name, company_name)")
      .eq("bank_account_id", input.bankAccountId)
      .gte("expense_date", from)
      .lte("expense_date", to),
    supabase
      .from("vendor_payments")
      .select("id, paid_on, amount, expense_category, vendor_invoice_id")
      .eq("bank_account_id", input.bankAccountId)
      .gte("paid_on", from)
      .lte("paid_on", to),
  ])

  if (isHardError(expenses.error)) {
    return { status: "error", error: "Could not check for a duplicate." }
  }
  if (isHardError(payments.error)) {
    return { status: "error", error: "Could not check for a duplicate." }
  }

  const matches: DuplicateMatch[] = []

  for (const row of expenses.data ?? []) {
    if (row.id === input.exceptExpenseId) continue
    if (moneyCents(toNumber(row.amount)) !== wanted) continue
    matches.push({
      kind: "Operational Expense",
      date: row.expense_date,
      amount: toNumber(row.amount),
      label: embeddedName(row.vendors) || row.category?.trim() || "Operational Expense",
    })
  }

  const paymentRows = (payments.data ?? []).filter((row) => {
    if (row.id === input.exceptPaymentId) return false
    return moneyCents(toNumber(row.amount)) === wanted
  })
  const vendorNames = await vendorNamesForPayments(supabase, paymentRows)

  for (const row of paymentRows) {
    matches.push({
      kind: "Vendor Payment",
      date: row.paid_on,
      amount: toNumber(row.amount),
      label:
        vendorNames.get(row.id) ||
        row.expense_category?.trim() ||
        "Vendor Payment",
    })
  }

  matches.sort((left, right) => right.date.localeCompare(left.date) || left.kind.localeCompare(right.kind))
  const shown = matches.slice(0, matchLimit)
  if (shown.length === 0) {
    return { status: "ok", notes: input.notes }
  }

  const reason = input.duplicateReason.replace(/\s+/g, " ").trim()
  if (!input.confirmNotDuplicate) {
    return {
      status: "blocked",
      matches: shown,
      reasonError: "Tick This Is Not A Duplicate and enter a reason.",
    }
  }
  if (!reason) {
    return {
      status: "blocked",
      matches: shown,
      reasonError: "Enter a reason.",
    }
  }
  if (reason.length > 300) {
    return {
      status: "blocked",
      matches: shown,
      reasonError: "Use 300 characters or fewer.",
    }
  }

  return {
    status: "ok",
    notes: notesWithDuplicateOverride(input.notes, reason),
  }
}

async function vendorNamesForPayments(
  supabase: Db,
  rows: { id: string; vendor_invoice_id: string }[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  const invoiceIds = [...new Set(rows.map((row) => row.vendor_invoice_id))]
  if (invoiceIds.length === 0) return names

  const invoices = await supabase
    .from("vendor_invoices")
    .select("id, purchase_order_id")
    .in("id", invoiceIds)
  if (invoices.error || !invoices.data) return names

  const orderIds = [...new Set(invoices.data.map((row) => row.purchase_order_id))]
  if (orderIds.length === 0) return names

  const orders = await supabase
    .from("vendor_purchase_orders")
    .select("id, vendor_id")
    .in("id", orderIds)
  if (orders.error || !orders.data) return names

  const vendorIds = [...new Set(orders.data.map((row) => row.vendor_id))]
  if (vendorIds.length === 0) return names

  const vendors = await supabase
    .from("vendors")
    .select("id, person_name, company_name")
    .in("id", vendorIds)
  if (vendors.error || !vendors.data) return names

  const vendorById = new Map(
    vendors.data.map((row) => [row.id, vendorDisplayName(row.company_name, row.person_name)]),
  )
  const vendorByOrder = new Map(
    orders.data.map((row) => [row.id, vendorById.get(row.vendor_id) ?? ""]),
  )
  const vendorByInvoice = new Map(
    invoices.data.map((row) => [row.id, vendorByOrder.get(row.purchase_order_id) ?? ""]),
  )
  for (const row of rows) {
    const name = vendorByInvoice.get(row.vendor_invoice_id) ?? ""
    if (name) names.set(row.id, name)
  }
  return names
}

function embeddedName(
  value:
    | { person_name: string | null; company_name: string | null }
    | { person_name: string | null; company_name: string | null }[]
    | null,
): string {
  const row = Array.isArray(value) ? value[0] : value
  if (!row) return ""
  return vendorDisplayName(row.company_name, row.person_name)
}

function vendorDisplayName(
  companyName: string | null | undefined,
  personName: string | null | undefined,
): string {
  const company = companyName?.trim() ?? ""
  if (company) return company
  return personName?.trim() ?? ""
}

function isHardError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === "42501" || /permission denied/i.test(error.message ?? "")) return false
  return true
}
