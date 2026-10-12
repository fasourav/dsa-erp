import { createServerClient } from "@supabase/ssr"
import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { getSupabaseEnv } from "@/lib/supabase/env"
import type { Database } from "@/types/database.types"

const otpTypes = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
])

const inviteErrorPath = "/login?error=invite"

function isEmailOtpType(value: string): value is EmailOtpType {
  return otpTypes.has(value)
}

function safeNextPath(value: string | null): string | null {
  if (value == null || value.trim() === "") return "/set-password"

  const next = value.trim()
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null
  if (next.includes("\\") || next.includes("://") || /[\u0000-\u001F\u007F]/.test(next)) {
    return null
  }

  let decoded = next
  try {
    decoded = decodeURIComponent(next)
  } catch {
    return null
  }

  if (!decoded.startsWith("/") || decoded.startsWith("//") || decoded.startsWith("/\\")) return null
  if (decoded.includes("\\") || decoded.includes("://") || /[\u0000-\u001F\u007F]/.test(decoded)) {
    return null
  }

  try {
    const url = new URL(decoded, "https://dsa-erp.vercel.app")
    if (url.origin !== "https://dsa-erp.vercel.app") return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const pendingCookies: {
    name: string
    value: string
    options: Parameters<NextResponse["cookies"]["set"]>[2]
  }[] = []
  let cacheHeaders: Record<string, string> = {}

  const { url, key } = getSupabaseEnv()
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          const index = pendingCookies.findIndex((cookie) => cookie.name === name)
          const nextCookie = { name, value, options }
          if (index === -1) pendingCookies.push(nextCookie)
          else pendingCookies[index] = nextCookie
        })
        if (Object.keys(headers).length > 0) cacheHeaders = headers
      },
    },
  })

  const next = safeNextPath(request.nextUrl.searchParams.get("next"))
  const tokenHash = request.nextUrl.searchParams.get("token_hash")
  const type = request.nextUrl.searchParams.get("type")
  const code = request.nextUrl.searchParams.get("code")

  let destination = inviteErrorPath

  if (next && tokenHash && type && isEmailOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (!error) destination = next
  } else if (next && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) destination = next
  }

  const redirectUrl = request.nextUrl.clone()
  const parsed = new URL(destination, request.url)
  redirectUrl.pathname = parsed.pathname
  redirectUrl.search = parsed.search
  redirectUrl.hash = parsed.hash

  const redirectResponse = NextResponse.redirect(redirectUrl)
  pendingCookies.forEach(({ name, value, options }) => {
    redirectResponse.cookies.set(name, value, options)
  })
  Object.entries(cacheHeaders).forEach(([header, value]) => {
    redirectResponse.headers.set(header, value)
  })

  return redirectResponse
}
