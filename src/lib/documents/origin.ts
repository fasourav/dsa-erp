import { headers } from "next/headers"

function parseOrigin(raw: string | undefined | null): URL | null {
  const trimmed = raw?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url
  } catch {
    return null
  }
}

export function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
}

export function isVercelHostname(hostname: string): boolean {
  return hostname.endsWith(".vercel.app")
}

export function headerRequestUrl(headerList: Pick<Headers, "get">): URL | null {
  const host =
    headerList.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    headerList.get("host")?.split(",")[0]?.trim()
  if (!host) return null
  const forwardedProto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim()
  const proto =
    forwardedProto ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") || host.startsWith("[::1]")
      ? "http"
      : "https")
  return parseOrigin(`${proto}://${host}`)
}

export function originFromHeaders(headerList: Pick<Headers, "get">): string {
  const reqUrl = headerRequestUrl(headerList)
  if (reqUrl && isLocalHostname(reqUrl.hostname)) {
    return reqUrl.origin
  }

  if (process.env.VERCEL_ENV === "preview" && reqUrl) {
    return reqUrl.origin
  }

  const configuredRaw = parseOrigin(process.env.NEXT_PUBLIC_SITE_URL)
  const configured =
    configuredRaw && !isLocalHostname(configuredRaw.hostname) ? configuredRaw : null
  const vercelProd =
    process.env.VERCEL_ENV !== "preview" && process.env.VERCEL_ENV !== "development"
      ? parseOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL)
      : null

  const customDomain = [reqUrl, configured, vercelProd].find(
    (candidate): candidate is URL =>
      candidate != null &&
      !isLocalHostname(candidate.hostname) &&
      !isVercelHostname(candidate.hostname),
  )
  if (customDomain) return customDomain.origin

  return (reqUrl ?? configured ?? vercelProd ?? configuredRaw)?.origin ?? "http://localhost:3000"
}

export async function requestOrigin(): Promise<string> {
  const headerList = await headers()
  return originFromHeaders(headerList)
}
