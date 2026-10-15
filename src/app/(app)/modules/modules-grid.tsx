"use client"

import Link from "next/link"

import { useAccess } from "@/components/access-provider"
import { PageHeader } from "@/components/page-header"
import { canSeeNav, navItems } from "@/lib/access"
import { navIcons } from "@/lib/nav-icons"

// The phone "All Modules" tab: every destination the sidebar would show.
export function ModulesGrid() {
  const access = useAccess()
  const items = navItems.filter((item) => canSeeNav(access, item))

  return (
    <>
      <PageHeader
        title="All Modules"
        description={`${items.length} ${items.length === 1 ? "Module" : "Modules"}`}
        className="md:mb-6"
      />
      <ul className="grid grid-cols-3 gap-2.5 pt-1 sm:grid-cols-4 md:grid-cols-4 md:gap-4 lg:grid-cols-6">
        {items.map((item) => {
          const Icon = navIcons[item.href]
          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                prefetch={false}
                className="flex h-full min-h-26 flex-col justify-between rounded-2xl px-3 pt-3.5 pb-3 glass-panel transition-transform active:scale-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50 md:min-h-32 md:rounded-card md:p-4.5"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary-tint text-primary-text">
                  {Icon ? <Icon aria-hidden="true" className="size-5" /> : null}
                </span>
                <span className="mt-2.5 text-label leading-tight font-strong tracking-[-0.01em] md:text-callout">
                  {item.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}
