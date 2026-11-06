"use client"

import { ChevronLeft } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useSyncExternalStore, type ReactNode } from "react"

import { AccountMenu, MobileMoreMenu } from "@/components/account-menu"
import { AppSidebar } from "@/components/app-sidebar"
import { DsaBadge } from "@/components/dsa-badge"
import { MobileTabBar, useTabRoots } from "@/components/mobile-tab-bar"
import { ShellHeaderProvider } from "@/components/shell-header"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useSidebarPresence } from "@/components/use-sidebar-presence"
import { navItems } from "@/lib/access"
import type { AccountIdentity } from "@/lib/account-identity"
import { modulesHref } from "@/lib/nav-icons"
import { sidebarExpanded, sidebarModeStore } from "@/lib/sidebar-mode"
import type { ThemePreference } from "@/lib/theme"
import { cn } from "@/lib/utils"

const DocumentsMenu = dynamic(
  () => import("@/components/documents-menu").then((m) => m.DocumentsMenu),
  { ssr: false },
)

const ReportsMenu = dynamic(
  () => import("@/components/reports-menu").then((m) => m.ReportsMenu),
  { ssr: false },
)

const GlobalSearch = dynamic(
  () => import("@/components/global-search").then((m) => m.GlobalSearch),
  {
    ssr: false,
    loading: () => <Skeleton className="size-11 rounded-full bg-fill md:h-8 md:w-60" />,
  },
)

const topBarRoots = new Set(["/documents", "/reports"])

function backHref(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  for (let length = segments.length - 1; length > 0; length -= 1) {
    const parent = `/${segments.slice(0, length).join("/")}`
    if (topBarRoots.has(parent) || navItems.some((item) => item.href === parent)) return parent
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
  const modeStore = sidebarModeStore(account.email)
  const mode = useSyncExternalStore(
    modeStore.subscribe,
    modeStore.getSnapshot,
    modeStore.getServerSnapshot,
  )
  const [menuOpen, setMenuOpen] = useState(false)
  const presence = useSidebarPresence()
  const expanded = sidebarExpanded({
    mode,
    pointerInside: presence.pointerInside,
    focusInside: presence.focusInside,
    menuOpen,
  })
  const [headerSlot, setHeaderSlot] = useState(null as HTMLDivElement | null)
  const isTabRoot = tabRoots.includes(pathname)

  return (
    <ShellHeaderProvider slot={headerSlot}>
      <div className="relative flex h-svh bg-aurora print:block print:h-auto print:overflow-visible print:bg-background">
        <div
          data-sidebar-mode={mode}
          className={cn(
            "relative z-30 hidden w-25 shrink-0 print:hidden md:block",
            mode === "open" && "lg:w-70",
          )}
          {...presence.handlers}
        >
          <AppSidebar
            expanded={expanded}
            mode={mode}
            onModeChange={modeStore.write}
            onMenuOpenChange={setMenuOpen}
          />
        </div>
        <main
          id="main"
          className="relative min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth pt-safe pb-tabbar print:h-auto print:overflow-visible print:p-0 md:pt-0 md:pb-12"
        >
          <header className="flex h-12.5 items-center gap-2.5 px-4 pt-0.5 print:hidden md:mt-5.5 md:mb-2.5 md:h-10 md:pt-0 md:pr-10 md:pl-7">
            {isTabRoot ? (
              <Link
                href="/dashboard"
                aria-label="Dashboard"
                className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
              >
                <DsaBadge variant="icon" className="h-8.5" />
              </Link>
            ) : (
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
                <ReportsMenu />
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
