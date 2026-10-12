"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { LoginBackground } from "@/app/login/login-background"
import { BrandLockup } from "@/components/brand-mark"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
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

export function AcceptInvite({ lightMode }: { lightMode: boolean }) {
  const router = useRouter()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function accept() {
      const hash = hashParams()
      const code = new URLSearchParams(window.location.search).get("code")

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
        router.replace("/set-password")
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
        router.replace("/set-password")
        return
      }

      if (!cancelled) setFailed(true)
    }

    void accept()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-x-hidden px-4 py-10 sm:py-16">
      <div className="absolute inset-0" aria-hidden="true">
        <LoginBackground lightMode={lightMode} />
      </div>
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-8">
        <BrandLockup layout="stacked" priority className="w-full" />
        <Card className="relative w-full rounded-3xl border border-foreground/10 bg-card/70 shadow-2xl ring-foreground/10 backdrop-blur-2xl backdrop-saturate-150 before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-foreground/25">
          <CardHeader className="gap-1.5">
            <h1 className="font-heading text-2xl leading-tight font-medium tracking-tight">
              Accept Invite
            </h1>
          </CardHeader>
          <CardContent>
            {failed ? (
              <p role="alert" className="text-sm leading-relaxed text-destructive">
                {inviteError}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Signing you in from your invite.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
