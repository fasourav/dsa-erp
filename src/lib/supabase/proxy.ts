import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

import { contentSecurityPolicy } from "@/lib/csp"
import type { Database } from "@/types/database.types"

import { getSupabaseEnv } from "./env"

function withRequestHeaders(request: NextRequest, csp: string, nonce: string) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", csp)
  return requestHeaders
}

function redirectWithSession(
  request: NextRequest,
  supabaseResponse: NextResponse,
  pathname: string,
) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ""

  const redirectResponse = NextResponse.redirect(url)
  for (const cookie of supabaseResponse.cookies.getAll()) {
    redirectResponse.cookies.set(cookie)
  }

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = supabaseResponse.headers.get(header)
    if (value) {
      redirectResponse.headers.set(header, value)
    }
  }

  return redirectResponse
}

export async function updateSession(request: NextRequest) {
  const csp = contentSecurityPolicy()
  const requestHeaders = withRequestHeaders(request, csp.value, csp.nonce)
  const applyCsp = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp.value)
    return response
  }

  let supabaseResponse = applyCsp(
    NextResponse.next({
      request: { headers: requestHeaders },
    }),
  )

  const { url, key } = getSupabaseEnv()

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = applyCsp(
          NextResponse.next({
            request: { headers: requestHeaders },
          }),
        )
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
        Object.entries(headers).forEach(([header, value]) => {
          supabaseResponse.headers.set(header, value)
        })
      },
    },
  })

  // Do not run code between createServerClient and getClaims(). A simple
  // mistake can make it very hard to debug users being randomly signed out.
  const { data } = await supabase.auth.getClaims()
  const isAuthenticated = Boolean(data?.claims)
  const { pathname } = request.nextUrl

  // Default invites land on /auth/accept with the session in the hash. token_hash
  // links still use /auth/confirm. Both run before a session exists, then
  // /set-password runs after. Keep them open so neither bounce loops.
  // Cron routes have no session and check CRON_SECRET themselves.
  const isOpenPath =
    pathname === "/login" ||
    pathname === "/auth/confirm" ||
    pathname === "/auth/accept" ||
    pathname === "/set-password" ||
    pathname.startsWith("/verify/") ||
    pathname.startsWith("/api/cron/")

  if (!isAuthenticated && !isOpenPath) {
    return applyCsp(redirectWithSession(request, supabaseResponse, "/login"))
  }

  if (isAuthenticated && pathname === "/login") {
    return applyCsp(redirectWithSession(request, supabaseResponse, "/dashboard"))
  }

  return supabaseResponse
}
