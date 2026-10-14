"use client"

import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, type ReactNode } from "react"

import { AccountMenu, MobileMoreMenu } from "@/components/account-menu"
import { AppSidebar } from "@/components/app-sidebar"
import { DocumentsMenu } from "@/components/documents-menu"
import { GlobalSearch } from "@/components/global-search"
import { MobileTabBar, useTabRoots } from "@/components/mobile-tab-bar"
import { ShellHeaderProvider } from "@/components/shell-header"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { navItems } from "@/lib/access"
import type { AccountIdentity } from "@/lib/account-identity"
import { modulesHref } from "@/lib/nav-icons"
import type { ThemePreference } from "@/lib/theme"

function backHref(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  for (let length = segments.length - 1; length > 0; length -= 1) {
    const parent = `/${segments.slice(0, length).join("/")}`
    if (navItems.some((item) => item.href === parent)) return parent
  }
  return modulesHref
}

export function AppShell({
  children,
  theme,
  account,
}: {
  children: ReactNode
  theme: ThemePreference
  account: AccountIdentity
}) {
  const pathname = usePathname()
  const tabRoots = useTabRoots()
  const [collapsed, setCollapsed] = useState(false)
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null)
  const isTabRoot = tabRoots.includes(pathname)

  return (
    <ShellHeaderProvider slot={headerSlot}>
      <div className="relative flex h-svh bg-aurora print:block print:h-auto print:overflow-visible print:bg-background">
        <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((current) => !current)} />
        <main
          id="main"
          className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth pt-safe pb-tabbar print:h-auto print:overflow-visible print:p-0 md:pt-0 md:pb-12"
        >
          <header className="flex h-12.5 items-center gap-2.5 px-4 pt-0.5 print:hidden md:mt-5.5 md:mb-2.5 md:h-10 md:pt-0 md:pr-10 md:pl-7">
            {isTabRoot ? null : (
              <Button
                variant="outline"
                size="icon"
                aria-label="Back"
                className="md:hidden"
                nativeButton={false}
                render={<Link href={backHref(pathname)} />}
              >
                <ChevronLeft aria-hidden="true" className="size-5.5" strokeWidth={2.2} />
              </Button>
            )}
            <div ref={setHeaderSlot} className="flex min-w-0 flex-1 items-center" />
            <div className="flex items-center gap-2.5">
              <div className="hidden md:contents">
                <DocumentsMenu />
              </div>
              <GlobalSearch />
              <div className="hidden md:contents">
                <AccountMenu account={account} />
              </div>
              <div className="contents md:hidden">
                <MobileMoreMenu account={account} />
              </div>
              <ThemeToggle initialTheme={theme} className="hidden md:inline-flex" />
            </div>
          </header>
          <div className="px-4 print:px-0 md:pr-10 md:pl-7">{children}</div>
        </main>
        <MobileTabBar />
      </div>
    </ShellHeaderProvider>
  )
}
