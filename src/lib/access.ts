export const moduleKeys = [
  "dashboard",
  "leads",
  "clients",
  "projects",
  "backlog",
  "purchase_orders",
  "vendors",
  "vendor_payments",
  "accounts_payable",
  "client_invoices",
  "accounts_receivable",
  "income",
  "expense",
  "expenses",
  "banking",
  "vat_tax",
  "budgets",
  "assets",
  "employees",
  "payroll",
  "settings",
  "users",
] as const

export type ModuleKey = (typeof moduleKeys)[number]

export type PermissionAction = "view" | "add" | "edit" | "delete"

export type ModuleGrant = Record<PermissionAction, boolean>

export type AccessSnapshot = {
  userId: string
  role: string
  status: "active" | "invited" | "deactivated"
  showFinancials: boolean
  isOwner: boolean
  grants: Record<string, ModuleGrant>
  ownersOnly: string[]
}

export type NavItem = {
  href: string
  label: string
  module?: ModuleKey
  ownerOnly?: boolean
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", module: "dashboard" },
  { href: "/leads", label: "Leads", module: "leads" },
  { href: "/clients", label: "Clients", module: "clients" },
  { href: "/projects", label: "Projects", module: "projects" },
  { href: "/vendors", label: "Vendors", module: "vendors" },
  { href: "/purchase-orders", label: "Purchase Orders", module: "purchase_orders" },
  { href: "/accounts/invoices", label: "Client Invoices", module: "client_invoices" },
  { href: "/accounts/receivable", label: "Accounts Receivable", module: "accounts_receivable" },
  { href: "/income", label: "Income", module: "income" },
  { href: "/accounts/payable", label: "Accounts Payable", module: "accounts_payable" },
  { href: "/expense", label: "Expense", module: "expense" },
  { href: "/accounts/expenses", label: "Operational Expense", module: "expenses" },
  { href: "/backlog", label: "Backlog", module: "backlog" },
  { href: "/accounts/vat-tax", label: "VAT/Tax", module: "vat_tax" },
  { href: "/accounts/bank", label: "Bank", module: "banking" },
  { href: "/accounts/budgets", label: "Budgets", module: "budgets" },
  { href: "/assets", label: "Assets", module: "assets" },
  { href: "/hr/employees", label: "Employees", module: "employees" },
  { href: "/hr/payroll", label: "Payroll", module: "payroll" },
  { href: "/settings/users", label: "Users & Permissions", module: "users", ownerOnly: true },
  { href: "/activity", label: "Activity Log", ownerOnly: true },
  { href: "/settings", label: "Settings", module: "settings", ownerOnly: true },
]

export function allows(
  access: AccessSnapshot,
  module: string,
  action: PermissionAction,
): boolean {
  if (access.status === "deactivated") return false
  if (access.isOwner) return true
  if (access.ownersOnly.includes(module)) return false

  const grant = access.grants[module]
  if (!grant) return false
  return grant[action]
}

export function canSeeNav(access: AccessSnapshot, item: NavItem): boolean {
  if (item.ownerOnly) return access.isOwner
  if (!item.module) return false
  return allows(access, item.module, "view")
}

const dashboardSourceModules = [
  "projects",
  "leads",
  "clients",
  "vendor_payments",
  "purchase_orders",
  "expenses",
  "vat_tax",
  "banking",
  "client_invoices",
  "accounts_receivable",
  "accounts_payable",
  "income",
  "backlog",
] as const satisfies readonly ModuleKey[]

export function hasFullDashboardAccess(access: AccessSnapshot): boolean {
  if (!access.showFinancials) return false
  return dashboardSourceModules.every((module) => allows(access, module, "view"))
}

export function homePath(access: AccessSnapshot): string {
  const match = navItems.find((item) => canSeeNav(access, item))
  return match?.href ?? "/no-access"
}
