"use client"

import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Box,
  Calculator,
  Contact,
  FileText,
  FolderKanban,
  HandCoins,
  Landmark,
  LayoutDashboard,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  PiggyBank,
  Receipt,
  ScrollText,
  Settings,
  Shield,
  Truck,
  UserPlus,
  Users,
  Wallet,
  WalletCards,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useAccess } from "@/components/access-provider"
import { AccountMenu } from "@/components/account-menu"
import { BrandLockup, BrandMark } from "@/components/brand-mark"
import { Button } from "@/components/ui/button"
import { canSeeNav, navItems } from "@/lib/access"
import type { AccountIdentity } from "@/lib/account-identity"
import { cn } from "@/lib/utils"

const navIcons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/leads": UserPlus,
  "/clients": Users,
  "/projects": FolderKanban,
  "/vendors": Truck,
  "/purchase-orders": Receipt,
  "/accounts/invoices": FileText,
  "/accounts/receivable": ArrowDownLeft,
  "/income": HandCoins,
  "/accounts/payable": ArrowUpRight,
  "/expense": WalletCards,
  "/accounts/expenses": Wallet,
  "/backlog": ListTodo,
  "/accounts/vat-tax": Calculator,
  "/accounts/bank": Landmark,
  "/accounts/budgets": PiggyBank,
  "/assets": Box,
  "/hr/employees": Contact,
  "/hr/payroll": Banknote,
  "/settings/users": Shield,
  "/activity": ScrollText,
  "/settings": Settings,
}

export function AppSidebar({
  collapsed,
  account,
  onToggle,
}: {
  collapsed: boolean
  account: AccountIdentity
  onToggle: () => void
}) {
  const pathname = usePathname()
  const access = useAccess()
  const visibleItems = navItems.filter((item) => canSeeNav(access, item))

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-b border-sidebar-border bg-sidebar text-sidebar-foreground print:hidden md:min-h-0 md:border-r md:border-b-0",
        collapsed ? "md:w-16" : "md:w-60",
      )}
    >
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2 border-b border-border px-3",
          collapsed && "md:justify-center md:gap-0 md:px-0",
        )}
      >
        <div className={cn("min-w-0 flex-1", collapsed && "md:hidden")}>
          <BrandLockup priority />
        </div>
        <BrandMark className={cn("hidden size-8", collapsed && "md:inline-flex md:size-7")} />
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
          "gap-1 overflow-x-auto px-3 py-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-y-auto md:pb-6",
          collapsed ? "hidden md:flex" : "flex",
        )}
      >
        {visibleItems.map((item) => (
          <NavLink
            key={item.href}
            item={{ ...item, icon: navIcons[item.href] }}
            pathname={pathname}
            collapsed={collapsed}
          />
        ))}
      </nav>
      <div
        className={cn(
          "hidden border-t border-sidebar-border p-3 md:block",
          collapsed && "md:px-2",
        )}
      >
        <AccountMenu account={account} collapsed={collapsed} />
      </div>
    </aside>
  )
}

function isNavActive(pathname: string, href: string) {
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
  item,
  pathname,
  collapsed,
}: {
  item: { href: string; label: string; icon: LucideIcon | undefined }
  pathname: string
  collapsed: boolean
}) {
  const active = isNavActive(pathname, item.href)
  const Icon = item.icon
  if (!Icon) return null

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-lg border-l-4 border-transparent px-3 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        active &&
          "border-sidebar-primary-foreground bg-sidebar-primary font-medium text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground",
        collapsed && "md:justify-center md:px-2",
      )}
    >
      <Icon aria-hidden="true" className="size-4" />
      <span className={cn(collapsed && "md:sr-only")}>{item.label}</span>
    </Link>
  )
}
