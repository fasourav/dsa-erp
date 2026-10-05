export type AgingSummaryRow = {
  bucket: string
  amount: number
  count: number
}

export function sortAgingSummaries(
  rows: readonly AgingSummaryRow[],
): AgingSummaryRow[] {
  return [...rows].sort((left, right) => {
    const byRank = agingRank(left.bucket) - agingRank(right.bucket)
    if (byRank !== 0) {
      return byRank
    }

    return left.bucket.localeCompare(right.bucket, "en", { sensitivity: "base" })
  })
}

function agingRank(bucket: string): number {
  const normalized = bucket.trim().toLowerCase()
  if (
    !normalized ||
    normalized === "current" ||
    normalized.includes("not due") ||
    normalized.includes("not yet")
  ) {
    return 0
  }

  const match = /\d+/.exec(normalized)
  return match ? Number(match[0]) : 500
}
