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
      data-state={collapsed ? "collapsed" : "expanded"}
      className={cn(
        "group/sidebar absolute top-0 left-0 z-30 m-3.5 flex h-[calc(100svh-1.75rem)] min-h-0 w-18 flex-col items-stretch overflow-hidden rounded-sidebar px-3.25 pt-3.5 pb-3 text-sidebar-foreground glass-chrome transition-[width] duration-260 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none",
        !collapsed && "lg:w-63",
        !collapsed && mode === "auto" && "lg:shadow-2xl",
      )}
    >
      <div className="group/header relative mb-2 flex h-12.5 shrink-0 items-center">
        <Link
          href="/dashboard"
          prefetch={false}
          aria-label="Dashboard"
          className="relative flex h-12.5 min-w-0 flex-1 items-center rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              !collapsed && "lg:scale-95 lg:opacity-0",
              collapsed &&
                "lg:group-hover/header:scale-95 lg:group-hover/header:opacity-0 lg:group-focus-within/header:scale-95 lg:group-focus-within/header:opacity-0 lg:group-has-[[data-popup-open]]/header:scale-95 lg:group-has-[[data-popup-open]]/header:opacity-0",
            )}
          >
            <BrandMark priority className="h-7.5" />
          </span>
          <BrandLockup
            priority
            className={cn(
              "pointer-events-none pl-1 opacity-0 -translate-x-1 transition-[opacity,translate] duration-120 delay-0 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              !collapsed &&
                "lg:pointer-events-auto lg:translate-x-0 lg:opacity-100 lg:duration-200 lg:delay-80",
            )}
          />
        </Link>
        <DropdownMenu onOpenChange={(open) => onMenuOpenChange(open)}>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                className={cn(
                  "absolute top-1/2 right-1.5 z-10 hidden -translate-y-1/2 transition-[opacity,transform] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none lg:inline-flex",
                  collapsed
                    ? "pointer-events-none scale-95 opacity-0 lg:group-hover/header:pointer-events-auto lg:group-hover/header:scale-100 lg:group-hover/header:opacity-100 lg:group-focus-within/header:pointer-events-auto lg:group-focus-within/header:scale-100 lg:group-focus-within/header:opacity-100 data-[popup-open]:pointer-events-auto data-[popup-open]:scale-100 data-[popup-open]:opacity-100"
                    : "lg:pointer-events-auto lg:scale-100 lg:opacity-100 lg:delay-75",
                )}
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
          className="no-scrollbar -mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto overscroll-contain px-1 pb-2"
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
        aria-hidden={collapsed}
        className={cn(
          "pointer-events-none shrink-0 overflow-hidden px-3.25 pt-1 text-micro whitespace-nowrap text-muted-foreground opacity-0 -translate-x-1 transition-[opacity,translate] duration-120 delay-0 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          !collapsed &&
            "lg:translate-x-0 lg:opacity-100 lg:duration-200 lg:delay-80",
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
    "relative flex h-8.25 w-full min-w-0 shrink-0 items-center gap-2.75 overflow-hidden rounded-lg px-3.25 text-left text-ui font-book tracking-[-0.005em] whitespace-nowrap text-sidebar-foreground transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
    active &&
      "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-nav-active hover:bg-sidebar-primary",
  )

  return (
    <Tooltip disabled={!collapsed}>
      <TooltipTrigger
        render={
          <Link
            href={href}
            prefetch={false}
            aria-current={active ? "page" : undefined}
            className={className}
          />
        }
      >
        <span
          aria-hidden="true"
          className="relative z-10 grid size-4.5 shrink-0 place-items-center"
        >
          <Icon
            aria-hidden="true"
            className={cn(
              "size-4.25 shrink-0",
              active ? "text-sidebar-primary-foreground" : "text-muted-foreground",
            )}
          />
        </span>
        <span
          className={cn(
            "relative z-10 w-42 shrink-0 truncate opacity-0 -translate-x-1 pointer-events-none transition-[opacity,translate] duration-120 delay-0 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
            !collapsed &&
              "lg:pointer-events-auto lg:translate-x-0 lg:opacity-100 lg:duration-200 lg:delay-80",
          )}
        >
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className={cn(!collapsed && "lg:hidden")}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
