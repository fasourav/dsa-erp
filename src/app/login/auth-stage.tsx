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
    <main
      className="flex min-h-svh overflow-x-hidden"
      style={{
        background:
          "radial-gradient(ellipse at center, #243418 0%, #10180c 52%, #070c06 100%)",
      }}
    >
      <div className="m-auto px-3 py-6">
        <div className="relative aspect-square w-[min(760px,max(90vmin,34rem))]">
          <div
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 42%, #4d6b30 0%, #243418 38%, #10180c 72%)",
            }}
            aria-hidden="true"
          >
            <LoginBackground />
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="pointer-events-auto flex w-[min(16rem,56%)] flex-col items-center gap-3 sm:w-[min(20rem,52%)] sm:gap-4">
              <Image
                src="/brand/lockup-white.png"
                alt="DynamicSpace Architects & Engineers"
                width={2864}
                height={1002}
                priority
                loading="eager"
                className="h-auto w-full"
              />
              <div className="flex w-full flex-col gap-1 text-center">
                <h1 className="font-heading text-xl leading-tight font-medium tracking-tight text-primary-foreground sm:text-2xl">
                  {title}
                </h1>
                {description ? (
                  <p className="text-sm leading-snug text-primary-foreground/80">
                    {description}
                  </p>
                ) : null}
              </div>
              <div className="w-full">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
