import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

// Large title + actions. Phones: 34px title, actions wrap below as capsules.
// Desktop: 38px title, actions right-aligned on the title baseline.
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-2.5 flex flex-col gap-3.5 px-1 pt-1.5 md:mt-1.5 md:mb-6 md:flex-row md:items-end md:justify-between md:gap-6 md:px-0 md:pt-0",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-0.5 text-label font-semibold text-muted-foreground md:mb-1 md:font-medium">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-large-title font-bold md:text-page-title">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground md:mt-1.5">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:flex-nowrap md:gap-2.5">
          {actions}
        </div>
      ) : null}
    </div>
  )
}

// Section title between groups of cards ("Performance Metrics", "Margin Analysis").
export function SectionHeader({
  title,
  aside,
  className,
}: {
  title: ReactNode
  aside?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-2.5 gap-y-0.5 px-1 pt-5.5 pb-2 md:mx-0.5 md:mt-7.5 md:mb-3 md:px-0 md:pt-0 md:pb-0",
        className,
      )}
    >
      <h2 className="text-section">{title}</h2>
      {aside ? <span className="text-label text-muted-foreground">{aside}</span> : null}
    </div>
  )
}
