import { allows } from "@/lib/access"
import { fetchAllPages } from "@/lib/fetch-pages"
import { toNumber } from "@/lib/format"
import {
  lineBudgetStatus,
  projectBudgetStatus,
  roundMoney,
  sum,
  type BudgetCategory,
  type BudgetLineView,
  type BudgetStatus,
  type OverBudgetProject,
  type ProjectBudgetReportLine,
  type ProjectBudgetSnapshot,
} from "@/lib/project-budget-model"
import { getAccess } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"

export type {
  BudgetCategory,
  BudgetLineView,
  BudgetStatus,
  OverBudgetProject,
  ProjectBudgetReportLine,
  ProjectBudgetSnapshot,
} from "@/lib/project-budget-model"

const uncategorisedKey = "uncategorised"
const uncategorisedName = "Uncategorised"

export async function budgetStatusByProject(): Promise<Map<string, BudgetStatus>> {
  const access = await getAccess()
  if (!access || !(access.isOwner || access.showFinancials)) return new Map()

  try {
    const grouped = await loadBudgetGroups()
    const statuses = new Map<string, BudgetStatus>()
    for (const [projectId, lines] of grouped) {
      const status = projectBudgetStatus(lines)
      if (status && status !== "ok") statuses.set(projectId, status)
    }
    return statuses
  } catch (error) {
    if (isMissingBudgetRelation(error)) return new Map()
    return new Map()
  }
}

export async function getProjectBudget(projectId: string): Promise<ProjectBudgetSnapshot> {
  const empty = emptySnapshot()
  const access = await getAccess()
  const hidden = !access || !(access.isOwner || access.showFinancials)

  try {
    const supabase = await createClient()
    const [lineRows, actualRows, categories] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("project_budget_lines")
            .select("id, project_id, category_id, planned_amount, notes")
            .eq("project_id", projectId)
            .order("id", { ascending: true })
            .range(from, to),
        "Budget lines are larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("project_budget_actual")
            .select(
              "project_id, category_id, category_name, actual_amount, committed_amount",
            )
            .eq("project_id", projectId)
            .order("category_name", { ascending: true })
            .range(from, to),
        "Budget actuals are larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("project_expense_categories")
            .select("id, name, sort_order")
            .order("sort_order", { ascending: true })
            .order("name", { ascending: true })
            .range(from, to),
        "Category list is larger than expected.",
      ),
    ])

    const categoryList = categories.flatMap((row) => {
      const name = row.name?.trim() ?? ""
      if (!name) return []
      return [{ id: row.id, name, sortOrder: row.sort_order }]
    })
    const lines = assembleLines(lineRows, actualRows, categoryList)
    const totals = totalLines(lines)
    return {
      lines: hidden ? lines.map((line) => ({ ...line, status: "ok" as const })) : lines,
      categories: categoryList,
      totals,
      status: hidden ? null : projectBudgetStatus(lines),
      hidden,
      error: null,
    }
  } catch (error) {
    if (isMissingBudgetRelation(error)) return empty
    return { ...empty, error: "Could not load this budget." }
  }
}

export async function getProjectsOverBudget(): Promise<OverBudgetProject[]> {
  const access = await getAccess()
  if (!access || !(access.isOwner || access.showFinancials)) return []
  if (!allows(access, "projects", "view") && !allows(access, "project_budgets", "view")) {
    return []
  }

  try {
    const supabase = await createClient()
    const [grouped, projects] = await Promise.all([
      loadBudgetGroups(),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("projects")
            .select("id, name")
            .order("name", { ascending: true })
            .range(from, to),
        "Project list is larger than expected.",
      ),
    ])
    const names = new Map(projects.map((project) => [project.id, project.name?.trim() || "Project"]))
    const rows: OverBudgetProject[] = []
    for (const [projectId, lines] of grouped) {
      if (projectBudgetStatus(lines) !== "over") continue
      const planned = sum(lines.map((line) => line.planned))
      const actual = sum(lines.map((line) => line.actual))
      rows.push({
        id: projectId,
        name: names.get(projectId) || "Project",
        planned,
        actual,
        overAmount: roundMoney(actual - planned),
      })
    }
    rows.sort((left, right) => right.overAmount - left.overAmount || left.name.localeCompare(right.name))
    return rows
  } catch (error) {
    if (isMissingBudgetRelation(error)) return []
    return []
  }
}

export async function loadProjectBudgetReport(): Promise<
  | { status: "ok"; lines: ProjectBudgetReportLine[] }
  | { status: "missing" }
  | { status: "error" }
> {
  try {
    const supabase = await createClient()
    const [lineRows, actualRows, categories, projects] = await Promise.all([
      fetchAllPages(
        (from, to) =>
          supabase
            .from("project_budget_lines")
            .select("project_id, category_id, planned_amount")
            .order("id", { ascending: true })
            .range(from, to),
        "Budget lines are larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("project_budget_actual")
            .select(
              "project_id, project_name, category_id, category_name, actual_amount, committed_amount",
            )
            .order("project_name", { ascending: true })
            .range(from, to),
        "Budget actuals are larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("project_expense_categories")
            .select("id, name, sort_order")
            .order("sort_order", { ascending: true })
            .range(from, to),
        "Category list is larger than expected.",
      ),
      fetchAllPages(
        (from, to) =>
          supabase
            .from("projects")
            .select("id, name")
            .order("name", { ascending: true })
            .range(from, to),
        "Project list is larger than expected.",
      ),
    ])

    const categoryList = categories.flatMap((row) => {
      const name = row.name?.trim() ?? ""
      if (!name) return []
      return [{ id: row.id, name, sortOrder: row.sort_order }]
    })
    const names = new Map(projects.map((project) => [project.id, project.name?.trim() || "Project"]))
    for (const row of actualRows) {
      if (row.project_id && row.project_name?.trim()) {
        names.set(row.project_id, row.project_name.trim())
      }
    }

    const projectIds = new Set<string>()
    for (const row of lineRows) projectIds.add(row.project_id)
    for (const row of actualRows) {
      if (row.project_id) projectIds.add(row.project_id)
    }

    const lines: ProjectBudgetReportLine[] = []
    const orderedIds = [...projectIds].sort((left, right) =>
      (names.get(left) || "Project").localeCompare(names.get(right) || "Project", "en", {
        sensitivity: "base",
      }),
    )

    for (const projectId of orderedIds) {
      const assembled = assembleLines(
        lineRows.filter((row) => row.project_id === projectId),
        actualRows.filter((row) => row.project_id === projectId),
        categoryList,
      )
      if (assembled.length === 0) continue
      const projectName = names.get(projectId) || "Project"
      for (const line of assembled) {
        lines.push({
          project: projectName,
          category: line.categoryName,
          planned: line.planned,
          committed: line.committed,
          actual: line.actual,
          remaining: line.remaining,
          status: line.status,
          emphasis: "plain",
        })
      }
      const totals = totalLines(assembled)
      lines.push({
        project: projectName,
        category: "Project Total",
        planned: totals.planned,
        committed: totals.committed,
        actual: totals.actual,
        remaining: totals.remaining,
        status: projectBudgetStatus(assembled) ?? "ok",
        emphasis: "subtotal",
      })
    }

    if (lines.length > 0) {
      const body = lines.filter((line) => line.emphasis === "plain")
      const totals = totalLines(
        body.map((line) => ({
          planned: line.planned,
          committed: line.committed,
          actual: line.actual,
          remaining: line.remaining,
        })),
      )
      lines.push({
        project: "All Projects",
        category: "Total",
        planned: totals.planned,
        committed: totals.committed,
        actual: totals.actual,
        remaining: totals.remaining,
        status: projectBudgetStatus(body) ?? "ok",
        emphasis: "total",
      })
    }

    return { status: "ok", lines }
  } catch (error) {
    if (isMissingBudgetRelation(error)) return { status: "missing" }
    return { status: "error" }
  }
}

type LineRow = {
  id?: string
  project_id: string
  category_id: string
  planned_amount: number
  notes?: string | null
}

type ActualRow = {
  project_id: string | null
  category_id: string | null
  category_name: string | null
  actual_amount: number | null
  committed_amount: number | null
}

function assembleLines(
  lineRows: readonly LineRow[],
  actualRows: readonly ActualRow[],
  categories: readonly BudgetCategory[],
): BudgetLineView[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const merged = new Map<
    string,
    {
      lineId: string | null
      categoryId: string | null
      categoryName: string
      planned: number
      committed: number
      actual: number
      notes: string
      sortOrder: number
    }
  >()

  function slot(categoryId: string | null, categoryName: string) {
    const key = categoryId ?? uncategorisedKey
    const existing = merged.get(key)
    if (existing) return existing
    const category = categoryId ? byId.get(categoryId) : undefined
    const created = {
      lineId: null as string | null,
      categoryId,
      categoryName: category?.name || categoryName || uncategorisedName,
      planned: 0,
      committed: 0,
      actual: 0,
      notes: "",
      sortOrder: categoryId ? (category?.sortOrder ?? 1000) : 10000,
    }
    merged.set(key, created)
    return created
  }

  for (const row of lineRows) {
    const entry = slot(row.category_id, byId.get(row.category_id)?.name || "Category")
    entry.lineId = row.id ?? entry.lineId
    entry.planned = roundMoney(entry.planned + toNumber(row.planned_amount))
    entry.notes = row.notes?.trim() ?? entry.notes
  }

  for (const row of actualRows) {
    const entry = slot(row.category_id, row.category_name?.trim() || uncategorisedName)
    entry.actual = roundMoney(entry.actual + toNumber(row.actual_amount))
    entry.committed = roundMoney(entry.committed + toNumber(row.committed_amount))
  }

  return [...merged.values()]
    .map((entry) => ({
      key: entry.categoryId ?? uncategorisedKey,
      lineId: entry.lineId,
      categoryId: entry.categoryId,
      categoryName: entry.categoryName,
      planned: entry.planned,
      committed: entry.committed,
      actual: entry.actual,
      remaining: roundMoney(entry.planned - entry.actual),
      notes: entry.notes,
      status:
        entry.lineId === null && entry.planned <= 0
          ? "ok"
          : lineBudgetStatus(entry.planned, entry.actual),
      sortOrder: entry.sortOrder,
    }))
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.categoryName.localeCompare(right.categoryName, "en", { sensitivity: "base" }),
    )
}

async function loadBudgetGroups() {
  const supabase = await createClient()
  const [lineRows, actualRows] = await Promise.all([
    fetchAllPages(
      (from, to) =>
        supabase
          .from("project_budget_lines")
          .select("project_id, category_id, planned_amount")
          .order("id", { ascending: true })
          .range(from, to),
      "Budget lines are larger than expected.",
    ),
    fetchAllPages(
      (from, to) =>
        supabase
          .from("project_budget_actual")
          .select("project_id, category_id, category_name, actual_amount, committed_amount")
          .order("project_id", { ascending: true })
          .range(from, to),
      "Budget actuals are larger than expected.",
    ),
  ])

  const grouped = new Map<string, { planned: number; actual: number }[]>()
  const keys = new Map<string, { planned: number; actual: number }>()

  function entry(projectId: string, categoryId: string | null) {
    const key = `${projectId}|${categoryId ?? uncategorisedKey}`
    const existing = keys.get(key)
    if (existing) return existing
    const created = { planned: 0, actual: 0 }
    keys.set(key, created)
    const list = grouped.get(projectId) ?? []
    list.push(created)
    grouped.set(projectId, list)
    return created
  }

  for (const row of lineRows) {
    const line = entry(row.project_id, row.category_id)
    line.planned = roundMoney(line.planned + toNumber(row.planned_amount))
  }
  for (const row of actualRows) {
    if (!row.project_id) continue
    const line = entry(row.project_id, row.category_id)
    line.actual = roundMoney(line.actual + toNumber(row.actual_amount))
  }
  return grouped
}

function totalLines(
  lines: readonly { planned: number; committed: number; actual: number }[],
) {
  const planned = roundMoney(sum(lines.map((line) => line.planned)))
  const committed = roundMoney(sum(lines.map((line) => line.committed)))
  const actual = roundMoney(sum(lines.map((line) => line.actual)))
  return {
    planned,
    committed,
    actual,
    remaining: roundMoney(planned - actual),
  }
}

function emptySnapshot(): ProjectBudgetSnapshot {
  return {
    lines: [],
    categories: [],
    totals: { planned: 0, committed: 0, actual: 0, remaining: 0 },
    status: null,
    hidden: false,
    error: null,
  }
}

function isMissingBudgetRelation(error: unknown) {
  const record = error as { code?: string; message?: string } | null
  const message = record?.message ?? ""
  return (
    record?.code === "42P01" ||
    record?.code === "PGRST205" ||
    record?.code === "PGRST204" ||
    /project_budget_(lines|actual)/i.test(message) ||
    /could not find the (table|relation|function)/i.test(message)
  )
}
