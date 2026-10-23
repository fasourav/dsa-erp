export const reportGroups = ["operational", "marketing", "salary"] as const

export type ReportGroup = (typeof reportGroups)[number]

export const reportGroupOptions: readonly { value: ReportGroup; label: string }[] = [
  { value: "operational", label: "Operational Expense" },
  { value: "marketing", label: "Marketing" },
  { value: "salary", label: "Salary" },
]

export type OfficeCategoryGroup = {
  id?: string
  name: string
  reportGroup: ReportGroup
}

export function isReportGroup(value: string | null | undefined): value is ReportGroup {
  return value === "operational" || value === "marketing" || value === "salary"
}

export function reportGroupLabel(group: ReportGroup): string {
  return reportGroupOptions.find((option) => option.value === group)?.label ?? "Operational Expense"
}

export function countsAsLabel(group: ReportGroup): string {
  return `Counts as ${reportGroupLabel(group)} (part of Admin Expense)`
}

// Same order as private.report_admin_bucket, except admin counts as operational.
export function keywordReportGroup(category: string | null | undefined): ReportGroup {
  const name = (category ?? "").trim().toLowerCase()
  if (/salary|payroll|wage/.test(name)) return "salary"
  if (/market|advert|promotion/.test(name)) return "marketing"
  return "operational"
}

// Category id, else category name, else the department name, else the keyword rule.
export function resolveCostGroup(input: {
  categoryId?: string | null
  categoryName?: string | null
  departmentName?: string | null
  categories?: readonly OfficeCategoryGroup[]
}): ReportGroup {
  const categories = input.categories ?? []
  const categoryId = input.categoryId?.trim() ?? ""
  if (categoryId) {
    const byId = categories.find((category) => category.id === categoryId)
    if (byId) return byId.reportGroup
  } else {
    const name = (input.categoryName ?? "").trim().toLowerCase()
    if (name) {
      const byName = categories.find(
        (category) => category.name.trim().toLowerCase() === name,
      )
      if (byName) return byName.reportGroup
    }
  }

  const departmentName = input.departmentName?.trim() ?? ""
  if (departmentName) return keywordReportGroup(departmentName)
  return keywordReportGroup(input.categoryName)
}

// Operational purchase order: the office category group, then the work type, then Operational.
export function resolveOperationalPoGroup(input: {
  officeCategoryId?: string | null
  workType?: string | null
  categories?: readonly OfficeCategoryGroup[]
}): ReportGroup {
  const categoryId = input.officeCategoryId?.trim() ?? ""
  if (categoryId) {
    const match = input.categories?.find((category) => category.id === categoryId)
    if (match) return match.reportGroup
  }
  return keywordReportGroup(input.workType?.trim() || "Operational")
}

export type OfficeBucketRow = {
  kind: "expense" | "purchase-order" | "payroll"
  amount: number
  categoryId?: string | null
  categoryName?: string | null
  departmentName?: string | null
  workType?: string | null
  projectLinked?: boolean
}

export function officeBucketTotals(
  rows: readonly OfficeBucketRow[],
  categories: readonly OfficeCategoryGroup[],
): Record<ReportGroup, number> {
  const totals: Record<ReportGroup, number> = {
    operational: 0,
    marketing: 0,
    salary: 0,
  }

  for (const row of rows) {
    if (row.projectLinked) continue
    if (row.kind === "payroll") {
      totals.salary += row.amount
      continue
    }
    const group =
      row.kind === "purchase-order"
        ? resolveOperationalPoGroup({
            officeCategoryId: row.categoryId,
            workType: row.workType,
            categories,
          })
        : resolveCostGroup({
            categoryId: row.categoryId,
            categoryName: row.categoryName,
            departmentName: row.departmentName,
            categories,
          })
    totals[group] += row.amount
  }

  return totals
}

export function assertReportGroupChecks(): void {
  const categories: OfficeCategoryGroup[] = [
    { id: "salary", name: "Employee Salary", reportGroup: "salary" },
    { id: "rent", name: "Office Rent", reportGroup: "operational" },
    { id: "materials", name: "Office Materials", reportGroup: "operational" },
    { id: "legal", name: "Legal", reportGroup: "operational" },
    { id: "internet", name: "Internet Bill", reportGroup: "operational" },
  ]

  for (const category of categories) {
    if (!isReportGroup(category.reportGroup)) {
      throw new Error(`${category.name} is missing a report group.`)
    }
  }

  if (keywordReportGroup("Internet Bill") !== "operational") {
    throw new Error("Internet Bill should stay operational under the keyword rule.")
  }
  if (keywordReportGroup("Office Rent") !== "operational") {
    throw new Error("An admin keyword should count as operational.")
  }
  if (keywordReportGroup("Employee Salary") !== "salary") {
    throw new Error("Employee Salary should count as salary.")
  }
  if (keywordReportGroup("Marketing Campaign") !== "marketing") {
    throw new Error("A marketing keyword should count as marketing.")
  }
  if (isReportGroup("admin")) {
    throw new Error("Admin is a total, not a report group.")
  }
  if (
    resolveCostGroup({
      categoryName: "Internet Bill",
      departmentName: "Design",
      categories,
    }) !== "operational"
  ) {
    throw new Error("Internet Bill should use its category group.")
  }
  if (
    resolveCostGroup({
      categoryName: "Tea",
      departmentName: "Admin",
      categories,
    }) !== "operational"
  ) {
    throw new Error("An unmatched category should use the department, and admin counts as operational.")
  }
  if (resolveCostGroup({ categoryName: "Tea", categories }) !== "operational") {
    throw new Error("An unmatched category with no department should use the keyword rule.")
  }
  if (
    resolveCostGroup({
      categoryId: "missing",
      categoryName: "Internet Bill",
      departmentName: "Admin",
      categories,
    }) !== "operational"
  ) {
    throw new Error("A missing category id should fall through to the department.")
  }
  if (
    resolveOperationalPoGroup({
      officeCategoryId: "legal",
      workType: "Legal Work",
      categories,
    }) !== "operational"
  ) {
    throw new Error("An operational purchase order should use the office category group.")
  }
  if (
    resolveOperationalPoGroup({ workType: "Legal Work", categories }) !== "operational"
  ) {
    throw new Error("A purchase order with no office category should use the work type.")
  }

  const rows: OfficeBucketRow[] = [
    {
      kind: "expense",
      amount: 1000,
      categoryName: "Internet Bill",
      departmentName: "Admin",
    },
    {
      kind: "expense",
      amount: 20000,
      categoryName: "Office Rent",
      departmentName: "Admin",
    },
    {
      kind: "purchase-order",
      amount: 25520,
      categoryId: "legal",
      workType: "Legal Work",
    },
    { kind: "payroll", amount: 500 },
    {
      kind: "expense",
      amount: 40,
      categoryName: "Site Tea",
      projectLinked: true,
    },
  ]

  const dashboard = officeBucketTotals(rows, categories)
  const financial = officeBucketTotals(rows, categories)
  for (const group of reportGroups) {
    if (dashboard[group] !== financial[group]) {
      throw new Error(`Dashboard ${group} does not match the financial report.`)
    }
  }
  const adminExpense = dashboard.operational + dashboard.marketing + dashboard.salary
  if (dashboard.operational !== 46520 || dashboard.marketing !== 0 || dashboard.salary !== 500) {
    throw new Error(
      `Unexpected buckets: operational ${dashboard.operational}, marketing ${dashboard.marketing}, salary ${dashboard.salary}.`,
    )
  }
  if (adminExpense !== 47020) {
    throw new Error(`Admin Expense total ${adminExpense} should be operational plus marketing plus salary.`)
  }
}
