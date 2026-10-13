import { getSupabaseEnv } from "@/lib/supabase/env"

function supabaseSources(): { http: string; ws: string } | null {
  try {
    const { url } = getSupabaseEnv()
    const parsed = new URL(url)
    const wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:"
    return {
      http: `${parsed.protocol}//${parsed.host}`,
      ws: `${wsProtocol}//${parsed.host}`,
    }
  } catch {
    return null
  }
}

export function contentSecurityPolicy(): { nonce: string; value: string } {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const isDev = process.env.NODE_ENV === "development"
  const supabase = supabaseSources()
  const connect = [
    "'self'",
    supabase?.http,
    supabase?.ws,
    isDev ? "ws: wss: http://localhost:* http://127.0.0.1:* https://localhost:* https://127.0.0.1:*" : null,
  ]
    .filter(Boolean)
    .join(" ")

  const img = ["'self'", "blob:", "data:", supabase?.http].filter(Boolean).join(" ")

  const header = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img}`,
    "font-src 'self' data:",
    "object-src blob:",
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    "child-src 'self' blob:",
    `connect-src ${connect}`,
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    isDev ? null : "upgrade-insecure-requests",
  ]
    .filter(Boolean)
    .join("; ")

  return { nonce, value: header }
}
