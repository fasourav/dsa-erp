const ALLOWED_METRICS = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"])

export async function POST(request: Request) {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return new Response(null, { status: 204 })
  }

  if (!raw || typeof raw !== "object") {
    return new Response(null, { status: 204 })
  }

  const record = raw as Record<string, unknown>
  const name = typeof record.name === "string" ? record.name : ""
  const value =
    typeof record.value === "number" && Number.isFinite(record.value) ? record.value : null
  if (!ALLOWED_METRICS.has(name) || value === null) {
    return new Response(null, { status: 204 })
  }

  const line = {
    type: "web-vital",
    name,
    value: Math.round(value * 1000) / 1000,
    rating: typeof record.rating === "string" ? record.rating.slice(0, 32) : undefined,
    id: typeof record.id === "string" ? record.id.slice(0, 64) : undefined,
    navigationType:
      typeof record.navigationType === "string" ? record.navigationType.slice(0, 32) : undefined,
    pathname: typeof record.pathname === "string" ? record.pathname.slice(0, 200) : undefined,
    ts: new Date().toISOString(),
  }

  console.log(JSON.stringify(line))
  return new Response(null, { status: 204 })
}
