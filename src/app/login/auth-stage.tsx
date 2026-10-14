import Image from "next/image"
import type { ReactNode } from "react"

// Atrium sign-in stage (login, set password, invite). Phones: the olive sphere
// rises behind the lockup and a light glass card sits at the bottom. Desktop:
// concentric rings, the sphere centred, and a clear glass card on top of it.
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
    <main className="relative isolate flex min-h-svh flex-col justify-end overflow-hidden bg-aurora pt-safe pb-[max(2.5rem,calc(env(safe-area-inset-bottom,0px)+1rem))] md:items-center md:justify-center md:bg-login-halo md:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+1.25rem)] left-1/2 size-170 -translate-x-1/2 rounded-full border border-login-ring md:inset-0 md:m-auto md:size-[min(1100px,150vmin)] md:translate-x-0" />
        <div className="absolute inset-0 m-auto hidden size-[min(900px,122vmin)] rounded-full border border-login-ring md:block" />
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+4.375rem)] left-1/2 size-140 -translate-x-1/2 rounded-full bg-login-sphere-phone shadow-login-sphere md:inset-0 md:m-auto md:size-[min(720px,96vmin)] md:translate-x-0 md:bg-login-sphere" />
        <div className="absolute top-[calc(env(safe-area-inset-top,0px)+13.125rem)] inset-x-0 flex justify-center md:hidden">
          <Image
            src="/brand/lockup-white.png"
            alt=""
            width={2864}
            height={1002}
            priority
            loading="eager"
            className="h-16 w-auto"
          />
        </div>
      </div>

      <div className="relative mx-3.5 rounded-hero bg-login-card-phone px-5 pt-6.5 pb-5.5 shadow-chrome backdrop-blur-[16px] backdrop-saturate-190 md:mx-0 md:w-105 md:bg-login-card md:px-9.5 md:pt-9.5 md:pb-8 md:text-login-ink md:shadow-login-card md:backdrop-blur-[28px] md:backdrop-saturate-180">
        <div className="mb-6 hidden justify-center md:flex">
          <Image
            src="/brand/lockup-white.png"
            alt="DynamicSpace Architects & Engineers"
            width={2864}
            height={1002}
            priority
            loading="eager"
            className="h-16 w-auto"
          />
        </div>
        <h1 className="text-center text-[1.75rem] leading-[1.1] font-bold tracking-[-0.025em] md:text-3xl md:tracking-[-0.03em]">
          {title}
        </h1>
        {description ? (
          <p className="mx-2.5 mt-1.5 mb-4.5 text-center text-[0.90625rem] leading-snug text-muted-foreground md:mx-0 md:mb-6 md:text-sm md:text-login-ink-muted">
            {description}
          </p>
        ) : (
          <div className="mb-4.5 md:mb-6" />
        )}
        {children}
      </div>

      <p className="relative mt-4 text-center text-xs text-subtle-foreground md:absolute md:inset-x-0 md:bottom-8.5 md:mt-0 md:text-caption md:text-muted-foreground">
        DSA ERP · DynamicSpace Architects &amp; Engineers
      </p>
    </main>
  )
}
