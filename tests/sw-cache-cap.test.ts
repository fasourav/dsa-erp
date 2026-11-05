import assert from "node:assert/strict"
import { test } from "node:test"

import { entriesToEvict, STATIC_CACHE_MAX } from "../src/lib/sw-cache-cap.ts"

test("STATIC_CACHE_MAX is 80", () => {
  assert.equal(STATIC_CACHE_MAX, 80)
})

test("entriesToEvict returns empty when at or below cap", () => {
  const urls = Array.from({ length: 80 }, (_, i) => `https://erp.local/_next/static/${i}.js`)
  assert.deepEqual(entriesToEvict(urls, STATIC_CACHE_MAX, []), [])
  assert.deepEqual(entriesToEvict(urls.slice(0, 10), STATIC_CACHE_MAX, []), [])
})

test("entriesToEvict evicts oldest unpinned entries FIFO while preserving pinned PRECACHE", () => {
  const precache = [
    "https://erp.local/offline.html",
    "https://erp.local/icons/icon-192.png",
  ]
  const chunks = ["a.js", "b.js", "c.js", "d.js"].map(
    (name) => `https://erp.local/_next/static/${name}`,
  )
  const urls = [...precache, ...chunks]

  const evicted = entriesToEvict(urls, 4, precache)
  assert.deepEqual(evicted, [
    "https://erp.local/_next/static/a.js",
    "https://erp.local/_next/static/b.js",
  ])
})

test("entriesToEvict never evicts pinned entries even if all entries are pinned", () => {
  const pinned = ["https://erp.local/offline.html", "https://erp.local/icons/icon-192.png"]
  assert.deepEqual(entriesToEvict(pinned, 1, pinned), [])
})
