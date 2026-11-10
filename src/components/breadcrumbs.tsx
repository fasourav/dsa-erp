import Link from "next/link"

import { cn } from "@/lib/utils"

export type BreadcrumbItem = {
  label: string
  href?: string
}

export function Breadcrumbs({
  items,
  className,
}: {
  items: readonly BreadcrumbItem[]
  className?: string
}) {
  if (items.length === 0) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("hidden md:flex md:min-w-0 md:items-center", className)}
    >
      <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-label font-medium text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li
              key={`${index}-${item.label}`}
              className="inline-flex min-w-0 items-center gap-1.5"
            >
              {index > 0 ? (
                <span aria-hidden="true" className="shrink-0 text-subtle-foreground">
                  ›
                </span>
              ) : null}
              {!isLast && item.href ? (
                <Link
                  href={item.href}
                  className="max-w-64 truncate transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(
                    "max-w-64 truncate",
                    isLast && "font-semibold text-foreground",
                  )}
                >
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
