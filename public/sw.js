// DSA ERP service worker.
// Pages carry financial data, so HTML and API responses are never cached.
// Only hashed build assets, brand images, and the offline page are stored.
const VERSION = "atrium-v3"
const STATIC_CACHE = `dsa-static-${VERSION}`
const STATIC_CACHE_MAX = 80
const OFFLINE_URL = "/offline.html"
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/brand/badge-light.svg",
  "/brand/badge-dark.svg",
  "/brand/badge-icon-light.svg",
  "/brand/badge-icon-dark.svg",
  "/brand/mark-olive.png",
  "/brand/mark-white.png",
]

function evictionList(urls, max, keep) {
  const cap = Math.max(0, max)
  if (urls.length <= cap) return []
  const pinned = keep instanceof Set ? keep : new Set(keep)
  const evict = []
  let excess = urls.length - cap
  for (const url of urls) {
    if (excess <= 0) break
    if (pinned.has(url)) continue
    evict.push(url)
    excess -= 1
  }
  return evict
}

function pinnedUrls() {
  return new Set(PRECACHE.map((path) => new URL(path, self.location.origin).href))
}

function trimStaticCache(cache) {
  return cache.keys().then((keys) => {
    const urls = keys.map((req) => req.url)
    const toDelete = evictionList(urls, STATIC_CACHE_MAX, pinnedUrls())
    return Promise.all(toDelete.map((url) => cache.delete(url)))
  })
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("dsa-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/brand/") ||
      url.pathname.startsWith("/icons/"))
  )
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") return

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((response) => response || Response.error()),
      ),
    )
    return
  }

  const url = new URL(request.url)
  if (!isStaticAsset(url)) return

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            event.waitUntil(
              caches
                .open(STATIC_CACHE)
                .then((cache) => cache.put(request, copy).then(() => trimStaticCache(cache))),
            )
          }
          return response
        }),
    ),
  )
})
