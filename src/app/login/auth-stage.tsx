import Image from "next/image"
import type { ReactNode } from "react"

import { LoginBackground } from "@/app/login/login-background"

export function AuthStage({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-aurora px-4 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 aspect-square w-[min(760px,max(34rem,120vmin))] -translate-x-1/2 -translate-y-1/2"
      >
        <div className="absolute inset-0 overflow-hidden rounded-full bg-login-sphere shadow-login-sphere">
          <LoginBackground />
        </div>
      </div>

      <div className="relative flex w-full max-w-xs flex-col items-center gap-4">
        <Image
          src="/brand/dsa-logo-login.png"
          alt="DynamicSpace Architects & Engineers"
          width={2865}
          height={1211}
          priority
          sizes="(min-width: 768px) 280px, 200px"
          className="h-auto w-[200px] md:w-[280px]"
        />
        <div className="flex w-full flex-col gap-1 text-center">
          <h1 className="text-2xl leading-tight font-semibold tracking-tight text-login-ink">
            {title}
          </h1>
          {description ? (
            <p className="text-sm leading-snug text-login-ink-muted">{description}</p>
          ) : null}
        </div>
        <div className="w-full text-login-ink">{children}</div>
      </div>

      <p className="absolute inset-x-0 bottom-6 text-center text-xs text-login-ink-muted">
        DSA ERP · DynamicSpace Architects &amp; Engineers
      </p>
    </main>
  )
}
