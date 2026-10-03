"use client"

import { useState, type ReactNode } from "react"

import { AppSidebar } from "@/components/app-sidebar"
import { SignOutButton } from "@/components/sign-out-button"
import { ThemeToggle } from "@/components/theme-toggle"
import type { Theme } from "@/lib/theme"

export function AppShell({
  children,
  theme,
}: {
  children: ReactNode
  theme: Theme
}) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="flex shrink-0 items-center justify-end gap-2 border-b px-4 py-3 md:px-8">
        <SignOutButton />
        <ThemeToggle initialTheme={theme} />
      </header>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <AppSidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((current) => !current)}
        />
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 md:px-10 md:py-8">
          {children}
        </main>
      </div>
    </div>
  )
}
