import assert from "node:assert/strict"
import { test } from "node:test"

import { fetchPage } from "../src/lib/fetch-pages.ts"
import {
  buildPageHref,
  LIST_PAGE_SIZE,
  pageRange,
  parsePageParams,
  sanitizeSearch,
} from "../src/lib/page-query.ts"

test("LIST_PAGE_SIZE is 50", () => {
  assert.equal(LIST_PAGE_SIZE, 50)
})

test("parsePageParams clamps invalid pages and trims query", () => {
  assert.deepEqual(parsePageParams({}), { page: 1, q: "" })
  assert.deepEqual(parsePageParams({ page: "0", q: "  hello  " }), { page: 1, q: "hello" })
  assert.deepEqual(parsePageParams({ page: "-4" }), { page: 1, q: "" })
  assert.deepEqual(parsePageParams({ page: "abc" }), { page: 1, q: "" })
  assert.deepEqual(parsePageParams({ page: ["3", "9"], q: ["inv", "x"] }), {
    page: 3,
    q: "inv",
  })
  assert.equal(parsePageParams({ q: "x".repeat(150) }).q.length, 100)
})

test("pageRange computes zero-based inclusive PostgREST bounds", () => {
  assert.deepEqual(pageRange(1), { from: 0, to: 49 })
  assert.deepEqual(pageRange(2), { from: 50, to: 99 })
  assert.deepEqual(pageRange(0, 25), { from: 0, to: 24 })
})

test("sanitizeSearch strips PostgREST wildcard and filter metacharacters", () => {
  assert.equal(sanitizeSearch(`100%_test\\,("ok")'now'`), "100 test ok now")
  assert.equal(sanitizeSearch("   "), "")
})

test("buildPageHref preserves non-empty params and omits page=1", () => {
  assert.equal(buildPageHref("/accounts/invoices", 1, { q: "brick" }), "/accounts/invoices?q=brick")
  assert.equal(
    buildPageHref("/accounts/invoices", 3, { project: "p1", q: "brick" }),
    "/accounts/invoices?project=p1&q=brick&page=3",
  )
  assert.equal(buildPageHref("/accounts/expenses", 1, { q: "" }), "/accounts/expenses")
})

test("fetchPage falls back from PGRST103 past-end request to last page", async () => {
  const dataset = Array.from({ length: 120 }, (_, i) => ({ id: i + 1 }))
  const calls: Array<[number, number]> = []

  const result = await fetchPage(
    async (from, to) => {
      calls.push([from, to])
      if (from >= dataset.length) {
        return {
          data: null,
          error: { code: "PGRST103", message: "Requested range not satisfiable" },
          count: null,
        }
      }
      return {
        data: dataset.slice(from, to + 1),
        error: null,
        count: dataset.length,
      }
    },
    9,
    50,
  )

  assert.deepEqual(calls, [
    [400, 449],
    [0, 49],
    [100, 149],
  ])
  assert.equal(result.total, 120)
  assert.equal(result.pageCount, 3)
  assert.equal(result.page, 3)
  assert.equal(result.rows.length, 20)
})
