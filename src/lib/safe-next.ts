export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null
  if (value.length === 0 || value.length > 2048) return null
  if (/[\u0000-\u001F\u007F]/.test(value)) return null
  if (/^\s/.test(value)) return null
  if (value.includes("\\")) return null
  if (!value.startsWith("/") || value.startsWith("//")) return null

  let parsed: URL
  try {
    parsed = new URL(value, "https://x.invalid")
  } catch {
    return null
  }

  if (parsed.origin !== "https://x.invalid") return null

  const { pathname } = parsed
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null
  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/set-password" ||
    pathname.startsWith("/set-password/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/")
  ) {
    return null
  }

  parsed.searchParams.delete("_rsc")
  return `${parsed.pathname}${parsed.search}`
}
