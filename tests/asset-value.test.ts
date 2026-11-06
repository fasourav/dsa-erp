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

const { assetValue } = await import("../src/lib/asset-value.ts")
const { businessDate } = await import("../src/lib/business-time.ts")

test("partial-month policy unchanged: 9 months + 22 days", () => {
  // 2026-01-15 -> 2026-11-06: 9 months, 22 days (Oct has 31) = 9.7333 months.
  const value = assetValue("2026-01-15", 12_000, 1, "2026-11-06")
  assert.equal(value.monthlyDepreciation, 1_000)
  assert.equal(value.currentValue, 2_266.67)
})

test("Dhaka midnight boundary: 18:00 UTC already counts the next day", () => {
  const before = assetValue("2026-01-15", 12_000, 1, businessDate(new Date("2026-11-05T17:59:59Z")))
  const after = assetValue("2026-01-15", 12_000, 1, businessDate(new Date("2026-11-05T18:00:00Z")))
  assert.equal(before.currentValue, 2_300) // as of 2026-11-05: 9 + 21/30
  assert.equal(after.currentValue, 2_266.67) // as of 2026-11-06: 9 + 22/30
})

test("leap-day purchase", () => {
  // 2024-02-29 -> 2025-02-28: 11 months + 30 days (Jan) = 12 of 24 months.
  assert.equal(assetValue("2024-02-29", 1_200, 2, "2025-02-28").currentValue, 600)
})

test("year rollover", () => {
  // 2025-12-31 -> 2026-01-01: 0 months, 1 day (Dec has 31) = 1/30 month.
  assert.equal(assetValue("2025-12-31", 3_000, 1, "2026-01-01").currentValue, 2_991.67)
})

test("future purchase, bad date, zero life, fully depreciated", () => {
  assert.equal(assetValue("2026-12-01", 1_000, 1, "2026-11-06").currentValue, 1_000)
  assert.equal(assetValue("", 1_000, 1, "2026-11-06").currentValue, 1_000)
  assert.deepEqual(assetValue("2020-01-01", 1_000, 0, "2026-11-06"), {
    currentValue: 1_000,
    monthlyDepreciation: 0,
  })
  assert.equal(assetValue("2020-01-01", 1_000, 1, "2026-11-06").currentValue, 0)
})
