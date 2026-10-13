"use client"

import { useState, type ReactNode } from "react"

import { AccountMenu } from "@/components/account-menu"
import { AppSidebar } from "@/components/app-sidebar"
import { GlobalSearch } from "@/components/global-search"
import { ShellHeaderProvider } from "@/components/shell-header"
import { ThemeToggle } from "@/components/theme-toggle"
import type { AccountIdentity } from "@/lib/account-identity"
import type { Theme } from "@/lib/theme"

export function AppShell({
  children,
  theme,
  account,
}: {
  children: ReactNode
  theme: Theme
  account: AccountIdentity
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null)

  return (
    <ShellHeaderProvider slot={headerSlot}>
      <div className="flex h-svh flex-col bg-background md:flex-row">
          <AppSidebar
            collapsed={collapsed}
            account={account}
            onToggle={() => setCollapsed((current) => !current)}
          />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex h-16 shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-4 print:hidden md:overflow-visible md:px-10">
            <div ref={setHeaderSlot} className="flex min-w-0 flex-1 items-center" />
            <GlobalSearch />
            <div className="md:hidden">
              <AccountMenu account={account} />
            </div>
            <ThemeToggle initialTheme={theme} />
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8">
            {children}
          </main>
        </div>
      </div>
    </ShellHeaderProvider>
  )
}
