"use client"

import { useEffect, useState } from "react"

import { authAlertClassName } from "@/app/login/auth-styles"
import { createClient } from "@/lib/supabase/client"

const inviteError =
  "That invite link is invalid or has expired. Ask an owner to send a new invite."

function hashParams() {
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash
  return new URLSearchParams(hash)
}

function hashHasError(params: URLSearchParams) {
  return ["error", "error_code", "error_description"].some((key) => {
    const value = params.get(key)
    return Boolean(value && value.trim())
  })
}

function clearInviteUrl() {
  window.history.replaceState(window.history.state, "", window.location.pathname)
}

export function AcceptInvite({ origin }: { origin?: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function accept() {
      if (
        origin &&
        window.location.hostname.endsWith(".vercel.app") &&
        window.location.origin !== origin
      ) {
        window.location.replace(
          `${origin}${window.location.pathname}${window.location.search}${window.location.hash}`,
        )
        return
      }

      const search = new URLSearchParams(window.location.search)
      const tokenHash = search.get("token_hash")
      const type = search.get("type")
      if (tokenHash && type) {
        window.location.replace(`/auth/confirm${window.location.search}`)
        return
      }

      const hash = hashParams()
      const code = search.get("code")

      if (hashHasError(hash)) {
        clearInviteUrl()
        if (!cancelled) setFailed(true)
        return
      }

      const accessToken = hash.get("access_token")
      const refreshToken = hash.get("refresh_token")
      const supabase = createClient()

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (cancelled) return
        if (error) {
          const { data } = await supabase.auth.getSession()
          if (cancelled) return
          if (!data.session) {
            clearInviteUrl()
            setFailed(true)
            return
          }
        }
        clearInviteUrl()
        window.location.replace("/set-password")
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (error) {
          const { data } = await supabase.auth.getSession()
          if (cancelled) return
          if (!data.session) {
            clearInviteUrl()
            setFailed(true)
            return
          }
        }
        clearInviteUrl()
        window.location.replace("/set-password")
        return
      }

      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (data.user) {
        window.location.replace("/set-password")
        return
      }

      setFailed(true)
    }

    void accept()
    return () => {
      cancelled = true
    }
  }, [origin])

  return failed ? (
    <p role="alert" className={authAlertClassName}>
      {inviteError}
    </p>
  ) : (
    <p className="text-center text-sm leading-relaxed text-muted-foreground" aria-live="polite">
      Signing you in from your invite.
    </p>
  )
}
