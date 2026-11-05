export const STATIC_CACHE_MAX = 80

export function entriesToEvict(
  urls: readonly string[],
  max: number = STATIC_CACHE_MAX,
  keep: Iterable<string> = [],
): string[] {
  const cap = Math.max(0, max)
  if (urls.length <= cap) return []

  const pinned = keep instanceof Set ? keep : new Set(keep)
  const evict: string[] = []
  let excess = urls.length - cap

  for (const url of urls) {
    if (excess <= 0) break
    if (pinned.has(url)) continue
    evict.push(url)
    excess -= 1
  }

  return evict
}
