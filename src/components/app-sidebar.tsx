"use client"

import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAccess } from "@/components/access-provider"
import { BrandLockup, BrandMark } from "@/components/brand-mark"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { canSeeNav, navItems } from "@/lib/access"
import { navIcons } from "@/lib/nav-icons"
import { cn } from "@/lib/utils"

// Floating glass sidebar (desktop only). Between md and lg it is always the
// 72px icon rail; from lg up it is 252px unless the user collapses it.
export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const pathname = usePathname()
  const access = useAccess()
  const visibleItems = navItems.filter((item) => canSeeNav(access, item))

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "group/sidebar relative z-30 m-3.5 hidden w-18 shrink-0 flex-col items-center rounded-sidebar px-2.5 pt-3.5 pb-3 text-sidebar-foreground glass-chrome print:hidden md:flex",
        !collapsed && "lg:w-63 lg:items-stretch",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 flex-col items-center gap-3 pt-1.5 pb-4",
          !collapsed && "lg:flex-row lg:items-center lg:justify-between lg:gap-2 lg:pr-2 lg:pl-2.5",
        )}
      >
        <Link
          href="/dashboard"
          aria-label="Dashboard"
          className="rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrandMark priority className={cn("h-7.5", !collapsed && "lg:hidden")} />
          <BrandLockup priority className={cn("hidden", !collapsed && "lg:inline-flex")} />
        </Link>
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          className="hidden lg:inline-flex"
          aria-expanded={!collapsed}
          aria-controls="primary-navigation"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggle}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" />
          ) : (
            <PanelLeftClose aria-hidden="true" />
          )}
        </Button>
      </div>
      <TooltipProvider delay={300}>
        <nav
          id="primary-navigation"
          aria-label="Primary"
          className="no-scrollbar -mx-1 flex min-h-0 flex-1 flex-col gap-px overflow-y-auto px-1 pb-2"
        >
          {visibleItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={navIcons[item.href]}
              active={isNavActive(pathname, item.href)}
              collapsed={collapsed}
            />
          ))}
        </nav>
      </TooltipProvider>
    </aside>
  )
}

export function isNavActive(pathname: string, href: string) {
  const matches = pathname === href || pathname.startsWith(`${href}/`)
  if (!matches) return false
  return !navItems.some(
    (item) =>
      item.href !== href &&
      item.href.startsWith(`${href}/`) &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  )
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string
  label: string
  icon: LucideIcon | undefined
  active: boolean
  collapsed: boolean
}) {
  if (!Icon) return null

  const className = cn(
    "flex h-8.25 w-11 shrink-0 items-center justify-center gap-2.75 rounded-lg text-ui font-book tracking-[-0.005em] whitespace-nowrap text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
    !collapsed && "lg:w-auto lg:justify-start lg:px-3",
    active &&
      "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-nav-active hover:bg-sidebar-primary",
  )

  return (
    <Tooltip>
      <TooltipTrigger
        render={<Link href={href} aria-current={active ? "page" : undefined} className={className} />}
      >
        <Icon
          aria-hidden="true"
          className={cn(
            "size-4.25 shrink-0",
            active ? "text-sidebar-primary-foreground" : "text-muted-foreground",
          )}
        />
        <span className={cn("sr-only", !collapsed && "lg:not-sr-only")}>{label}</span>
      </TooltipTrigger>
      <TooltipContent side="right" className={cn(!collapsed && "lg:hidden")}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
