const buckets = new Map<string, { reset: number; count: number }>()

export function allowVerifyRequest(key: string): boolean {
  const now = Date.now()
  if (buckets.size > 5000) {
    for (const [entry, bucket] of buckets) {
      if (now > bucket.reset) buckets.delete(entry)
    }
  }

  const current = buckets.get(key)
  if (!current || now > current.reset) {
    buckets.set(key, { reset: now + 60_000, count: 1 })
    return true
  }

  if (current.count >= 30) return false
  current.count += 1
  return true
}

export function verifyClientKey(headerList: Headers): string {
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || headerList.get("x-real-ip") || "local"
}
