"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAccess } from "@/components/access-provider"
import { canSeeNav, navItems } from "@/lib/access"
import { modulesHref, navIcons, tabHrefs } from "@/lib/nav-icons"
import { cn } from "@/lib/utils"

const tabLabels: Record<string, string> = {
  "/modules": "All Modules",
}

export function useTabRoots() {
  const access = useAccess()
  const tabs: string[] = tabHrefs.filter((href) => {
    const item = navItems.find((entry) => entry.href === href)
    return item ? canSeeNav(access, item) : false
  })
  return [...tabs, modulesHref]
}

// Floating glass tab bar, phones only. Pages under a tab keep it selected.
export function MobileTabBar() {
  const pathname = usePathname()
  const tabs = useTabRoots()
  const activeTab =
    tabs.find((href) => pathname === href || pathname.startsWith(`${href}/`)) ??
    (tabs.includes(pathname) ? pathname : modulesHref)

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-37.5 bg-linear-to-b from-transparent to-background to-85% opacity-85 print:hidden md:hidden"
      />
      <nav
        aria-label="Tabs"
        className="fixed inset-x-4 bottom-tabbar z-30 mx-auto flex h-16 max-w-md items-center rounded-full p-1 glass-chrome print:hidden md:hidden"
      >
        {tabs.map((href) => {
          const Icon = navIcons[href]
          const label = tabLabels[href] ?? navItems.find((item) => item.href === href)?.label ?? href
          const active = activeTab === href
          return (
            <Link
              key={href}
              prefetch={false}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.75 rounded-full text-tab font-semibold text-foreground transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                active && "bg-tab-active text-tab-active-foreground",
              )}
            >
              {Icon ? <Icon aria-hidden="true" className="size-5.5" strokeWidth={1.9} /> : null}
              <span className="max-w-full truncate px-1">{label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
