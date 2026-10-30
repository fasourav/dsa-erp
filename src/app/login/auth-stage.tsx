import type { ReactNode } from "react"

import { LoginBackground } from "@/app/login/login-background"
import { DsaBadge } from "@/components/dsa-badge"

const AUTH_FOOTER = "ERP Portal - DynamicSpace Architects & Engineers"

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
    <main className="relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-aurora px-4 pt-[max(1.5rem,env(safe-area-inset-top,0px))] pb-[max(4rem,calc(env(safe-area-inset-bottom,0px)+2.5rem))] sm:px-6 md:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <LoginBackground />
      </div>

      <div className="relative flex w-full max-w-sm flex-col items-center gap-5 rounded-hero px-6 pt-7 pb-6 text-foreground glass-chrome shadow-float sm:max-w-md sm:px-8 sm:pt-8 sm:pb-7 md:w-105 md:max-w-none md:gap-6 md:px-9.5 md:pt-9 md:pb-8">
        <DsaBadge priority className="h-20 md:h-24" />
        <div className="flex w-full flex-col gap-1.5 text-center">
          <h1 className="text-dialog-title font-bold tracking-tight text-foreground md:text-large-title">
            {title}
          </h1>
          {description ? (
            <p className="text-callout text-muted-foreground md:text-ui">{description}</p>
          ) : null}
        </div>
        {children ? <div className="w-full text-foreground">{children}</div> : null}
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom,0px))] text-center text-micro text-muted-foreground md:bottom-6 md:text-caption">
        {AUTH_FOOTER}
      </p>
    </main>
  )
}
