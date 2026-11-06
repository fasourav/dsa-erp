import assert from "node:assert/strict"
import module from "node:module"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = path.resolve(process.cwd(), "src", `${specifier.slice(2)}.ts`)
      return nextResolve(pathToFileURL(target).href, context)
    }
    return nextResolve(specifier, context)
  },
})

const { buildDashboard, operatingCashAsOf } = await import(
  "../src/lib/dashboard-metrics.ts"
)

test("operatingCashAsOf excludes manual deposit and withdrawal while keeping operating flows", () => {
  const bank = [
    { date: "2026-01-10", amount: 50_000, direction: "inflow" as const, sourceKind: "project_income" },
    { date: "2026-01-12", amount: 25_000, direction: "inflow" as const, sourceKind: "deposit" },
    { date: "2026-01-15", amount: 12_000, direction: "outflow" as const, sourceKind: "vendor_expense" },
    { date: "2026-01-18", amount: 8_000, direction: "outflow" as const, sourceKind: "withdrawal" },
    { date: "2026-01-20", amount: 3_000, direction: "outflow" as const, sourceKind: "operational_expense" },
    { date: "2026-01-22", amount: 2_000, direction: "outflow" as const, sourceKind: "vat_tax" },
    { date: "2026-01-25", amount: 5_000, direction: "outflow" as const, sourceKind: "payroll" },
    { date: "2026-01-26", amount: 4_000, direction: "inflow" as const, sourceKind: "transfer" },
    { date: "2026-01-26", amount: 4_000, direction: "outflow" as const, sourceKind: "transfer" },
    { date: "2026-01-28", amount: 1_500, direction: "inflow" as const, sourceKind: "other" },
  ]

  // Opening balances are excluded from the KPI (v1.1.2):
  // 50,000 - 12,000 - 3,000 - 2,000 - 5,000 + 4,000 - 4,000 + 1,500 = 29,500
  assert.equal(operatingCashAsOf(bank, "2026-01-31"), 29_500)
})

test("buildDashboard cashBalance, cashDelta, and cashSpark ignore manual deposit and withdrawal", () => {
  const model = buildDashboard(
    {
      projects: [],
      clientCount: 0,
      leads: [],
      clients: [],
      invoices: [],
      orders: [],
      backlogYears: [],
      revenue: [{ date: "2026-02-05", amount: 40_000 }],
      vendorPayments: [],
      operational: [],
      taxes: [],
      bank: [
        { date: "2026-01-10", amount: 20_000, direction: "inflow", sourceKind: "project_income" },
        { date: "2026-01-15", amount: 90_000, direction: "inflow", sourceKind: "deposit" },
        { date: "2026-02-05", amount: 40_000, direction: "inflow", sourceKind: "project_income" },
        { date: "2026-02-10", amount: 30_000, direction: "outflow", sourceKind: "withdrawal" },
      ],
      openingBalance: 80_000,
      billed: 0,
      ledgerPaid: 0,
      receivables: 0,
      payables: 0,
      backlogCount: 0,
      launchDate: "2025-01-01",
    },
    new Date("2026-02-20T06:00:00Z"),
    2026,
  )

  // Jan end: 20,000 (ignores 80,000 opening and +90,000 deposit)
  // Feb 20: 20,000 + 40,000 = 60,000 (ignores -30,000 withdrawal)
  assert.equal(model.cashBalance, 60_000)
  assert.equal(model.cashDelta, 200)
  assert.deepEqual(model.cashSpark, [
    { label: "Jan", value: 20_000 },
    { label: "Feb", value: 60_000 },
  ])
  // Withdrawal compact metric still reports manual withdrawals separately
  assert.equal(model.snapshots[0]?.withdrawal, 30_000)
})

test("opening-only account contributes 0 to dashboard cash", () => {
  const model = buildDashboard(
    {
      projects: [],
      clientCount: 0,
      leads: [],
      clients: [],
      invoices: [],
      orders: [],
      backlogYears: [],
      revenue: [],
      vendorPayments: [],
      operational: [],
      taxes: [],
      bank: [],
      openingBalance: 5_000,
      billed: 0,
      ledgerPaid: 0,
      receivables: 0,
      payables: 0,
      backlogCount: 0,
      launchDate: "2025-01-01",
    },
    new Date("2026-02-20T06:00:00Z"),
    2026,
  )
  assert.equal(model.cashBalance, 0)
  assert.deepEqual(model.cashSpark, [
    { label: "Jan", value: 0 },
    { label: "Feb", value: 0 },
  ])
})
