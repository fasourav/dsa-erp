"use client"

import {
  Contact,
  FolderKanban,
  Landmark,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  Truck,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/vendors", label: "Vendors", icon: Truck },
  { href: "/purchase-orders", label: "Purchase Orders", icon: Receipt },
  { href: "/leads", label: "Leads", icon: UserPlus },
  { href: "/finance", label: "Finance", icon: Landmark },
  { href: "/hr", label: "HR", icon: Contact },
  { href: "/settings", label: "Settings", icon: Settings },
]

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:min-h-0 md:overflow-y-auto md:border-r md:border-b-0",
        collapsed ? "md:w-16" : "md:w-60",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-4",
          collapsed && "md:flex-col md:px-2",
        )}
      >
        <div className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
          <p className="text-[0.68rem] font-medium tracking-[0.22em] text-sidebar-foreground/60">
            DYNAMIC SPACE
          </p>
          <p className="mt-1 text-lg font-medium tracking-tight">DSA ERP</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-expanded={!collapsed}
          aria-controls="primary-navigation"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggle}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" className="size-4" />
          ) : (
            <PanelLeftClose aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>
      <nav
        id="primary-navigation"
        aria-label="Primary"
        className={cn(
          "gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-6",
          collapsed ? "hidden md:flex" : "flex",
        )}
      >
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`)
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active &&
                  "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                collapsed && "md:justify-center md:px-2",
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              <span className={cn(collapsed && "md:sr-only")}>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
