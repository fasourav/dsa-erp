"use client"

import { PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAccess } from "@/components/access-provider"
import { BrandLockup, BrandMark } from "@/components/brand-mark"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { canSeeNav, navItems } from "@/lib/access"
import { APP_VERSION_LABEL } from "@/lib/app-version"
import { navIcons } from "@/lib/nav-icons"
import {
  SIDEBAR_MODES,
  sanitizeSidebarMode,
  sidebarModeLabel,
  type SidebarMode,
} from "@/lib/sidebar-mode"
import { cn } from "@/lib/utils"

// Floating glass sidebar (desktop only). Between md and lg it is always the
// 72px icon rail. From lg up it follows the mode: Auto expands on hover/focus
// and overlays content; Always expanded reserves 252px; Always collapsed stays a rail.
export function AppSidebar({
  expanded,
  mode,
  onModeChange,
  onMenuOpenChange,
}: {
  expanded: boolean
  mode: SidebarMode
  onModeChange: (mode: SidebarMode) => void
  onMenuOpenChange: (open: boolean) => void
}) {
  const collapsed = !expanded
  const pathname = usePathname()
  const access = useAccess()
  const visibleItems = navItems.filter((item) => canSeeNav(access, item))

  return (
    <aside
      data-collapsed={collapsed}
      data-mode={mode}
      className={cn(
        "group/sidebar absolute top-0 left-0 z-30 m-3.5 flex h-[calc(100svh-1.75rem)] min-h-0 w-18 flex-col items-center rounded-sidebar px-2.5 pt-3.5 pb-3 text-sidebar-foreground glass-chrome transition-[width] duration-150 motion-reduce:transition-none",
        !collapsed && "lg:w-63 lg:items-stretch",
        !collapsed && mode === "auto" && "lg:shadow-2xl",
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
        <DropdownMenu onOpenChange={(open) => onMenuOpenChange(open)}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className="hidden lg:inline-flex"
                aria-controls="primary-navigation"
                aria-label={`Sidebar: ${sidebarModeLabel(mode)}`}
                title={`Sidebar: ${sidebarModeLabel(mode)}`}
              />
            }
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Sidebar</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={mode}
                onValueChange={(value) => onModeChange(sanitizeSidebarMode(value))}
              >
                {SIDEBAR_MODES.map((option) => (
                  <DropdownMenuRadioItem key={option} value={option}>
                    {sidebarModeLabel(option)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
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
      <p
        className={cn(
          "hidden shrink-0 px-3 pt-1 text-micro text-muted-foreground",
          !collapsed && "lg:block",
        )}
      >
        {APP_VERSION_LABEL}
      </p>
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
        render={<Link href={href} prefetch={false} aria-current={active ? "page" : undefined} className={className} />}
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
