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

const {
  BUSINESS_TIME_ZONE,
  businessDate,
  businessYearMonth,
  businessDayStartUtc,
  formatBusinessClock,
} = await import("../src/lib/business-time.ts")

test("time zone is Asia/Dhaka", () => {
  assert.equal(BUSINESS_TIME_ZONE, "Asia/Dhaka")
})

test("17:59 UTC is still the same Dhaka day; 18:00 UTC is the next Dhaka day", () => {
  assert.equal(businessDate(new Date("2026-11-05T17:59:59Z")), "2026-11-05")
  assert.equal(businessDate(new Date("2026-11-05T18:00:00Z")), "2026-11-06")
})

test("month and year rollover at Dhaka midnight", () => {
  assert.equal(businessDate(new Date("2026-01-31T18:00:00Z")), "2026-02-01")
  assert.equal(businessDate(new Date("2026-12-31T17:59:59Z")), "2026-12-31")
  assert.equal(businessDate(new Date("2026-12-31T18:00:00Z")), "2027-01-01")
  assert.deepEqual(businessYearMonth(new Date("2026-12-31T18:00:00Z")), { year: 2027, month: 1 })
  assert.deepEqual(businessYearMonth(new Date("2026-12-31T17:59:59Z")), { year: 2026, month: 12 })
})

test("leap day", () => {
  assert.equal(businessDate(new Date("2028-02-28T18:00:00Z")), "2028-02-29")
  assert.equal(businessDate(new Date("2028-02-29T18:00:00Z")), "2028-03-01")
})

test("Dhaka midnight boundaries convert to UTC instants", () => {
  assert.equal(businessDayStartUtc("2026-11-06"), "2026-11-05T18:00:00.000Z")
  assert.equal(businessDayStartUtc("2026-11-06", 1), "2026-11-06T18:00:00.000Z")
  assert.equal(businessDayStartUtc("2026-12-31", 1), "2026-12-31T18:00:00.000Z")
  assert.equal(businessDayStartUtc("2028-02-28", 1), "2028-02-28T18:00:00.000Z")
})

test("clock label is Dhaka wall time", () => {
  assert.equal(formatBusinessClock(new Date("2026-11-06T15:05:00Z")), "9:05 PM")
})

test("US DST transition days do not affect the Dhaka date", () => {
  // Run the suite under TZ=UTC, TZ=America/New_York and TZ=Asia/Dhaka (Task A6).
  assert.equal(businessDate(new Date("2026-03-08T07:30:00Z")), "2026-03-08")
  assert.equal(businessDate(new Date("2026-11-01T05:30:00Z")), "2026-11-01")
})
