import { ActivityLog, type ActivityChange, type ActivityRow } from "@/app/(app)/activity/activity-log"
import { PageHeader } from "@/components/page-header"
import { requireOwner } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { formatDayMonYear, formatMoney } from "@/lib/format"
import type { Json } from "@/types/database.types"

export const metadata = { title: "Activity Log" }

const moduleLabels: Record<string, string> = {
  dashboard: "Dashboard",
  leads: "Leads",
  clients: "Clients",
  projects: "Projects",
  project_progress: "Project Progress",
  backlog: "Backlog",
  purchase_orders: "Purchase Orders",
  quotations: "Quotations",
  work_orders: "Work Orders",
  vendors: "Vendors",
  vendor_payments: "Vendor Payments",
  accounts_payable: "Accounts Payable",
  client_invoices: "Client Invoices",
  accounts_receivable: "Accounts Receivable",
  income: "Income",
  expense: "Expense",
  expenses: "Operational Expense",
  banking: "Bank",
  vat_tax: "VAT/Tax",
  budgets: "Budgets",
  assets: "Assets",
  employees: "Employees",
  payroll: "Payroll",
  settings: "Settings",
  users: "Users & Permissions",
}

type ActivityRecord = {
  id: string
  action: string
  module: string
  summary: string
  created_at: string
  actor_id: string | null
  record_label?: string | null
  old_values?: Json | null
  new_values?: Json | null
}

const PAGE_SIZE = 50
const ACTIONS: Record<string, string> = { creates: "insert", edits: "update", deletes: "delete" }
const DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ""
}

// Dhaka midnight (UTC+6, no DST) as an ISO instant.
function dhakaStart(day: string, addDays = 0) {
  const date = new Date(`${day}T00:00:00+06:00`)
  date.setUTCDate(date.getUTCDate() + addDays)
  return date.toISOString()
}

export default async function ActivityPage({ searchParams }: { searchParams: SearchParams }) {
  await requireOwner()
  const params = await searchParams
  const filters = {
    q: param(params, "q").slice(0, 100),
    module: param(params, "module") in moduleLabels ? param(params, "module") : "all",
    user: UUID.test(param(params, "user")) || param(params, "user") === "system" ? param(params, "user") : "all",
    from: DATE.test(param(params, "from")) ? param(params, "from") : "",
    to: DATE.test(param(params, "to")) ? param(params, "to") : "",
    action: param(params, "action") in ACTIONS ? param(params, "action") : "all",
  }
  const requestedPage = Math.max(1, Math.floor(Number(param(params, "page")) || 1))
  const supabase = await createClient()
  let rows: ActivityRecord[] = []
  let total = 0
  let loadError: string | null = null

  let searchColumn = "search_text"
  const load = async (columns: string, page: number) => {
    let query = supabase.from("activity_log").select(columns, { count: "exact" })
    if (filters.module !== "all") query = query.eq("module", filters.module)
    if (filters.user === "system") query = query.is("actor_id", null)
    else if (filters.user !== "all") query = query.eq("actor_id", filters.user)
    if (filters.from) query = query.gte("created_at", dhakaStart(filters.from))
    if (filters.to) query = query.lt("created_at", dhakaStart(filters.to, 1))
    if (filters.action !== "all") query = query.eq("action", ACTIONS[filters.action])
    if (filters.q) {
      const term = filters.q.replace(/[%_\\,()"']/g, " ").trim()
      if (term) {
        const like = `%${term}%`
        // search_text also covers the changed field values (old and new).
        query = query.or(
          columns.includes("record_label")
            ? `${searchColumn}.ilike.${like},record_label.ilike.${like},module.ilike.${like}`
            : `summary.ilike.${like},module.ilike.${like}`,
        )
      }
    }
    const from = (page - 1) * PAGE_SIZE
    return query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
  }

  const run = async (columns: string) => {
    let result = await load(columns, requestedPage)
    // Past the end (PostgREST answers PGRST103): reload the first page, then the last one.
    if (requestedPage > 1 && result.error?.code === "PGRST103") {
      result = await load(columns, 1)
      const lastPage = Math.ceil((result.count ?? 0) / PAGE_SIZE)
      if (!result.error && lastPage > 1) result = await load(columns, lastPage)
    }
    return result
  }

  const full = "id, action, module, summary, created_at, actor_id, record_label, old_values, new_values"
  let result = await run(full)
  if (result.error && /search_text/i.test(result.error.message)) {
    searchColumn = "summary"
    result = await run(full)
  }
  if (result.error && /record_label|old_values|new_values|schema cache/i.test(result.error.message)) {
    result = await run("id, action, module, summary, created_at, actor_id")
  }
  if (result.error) loadError = result.error.message || "Could not load the activity log."
  else {
    rows = (result.data ?? []) as unknown as ActivityRecord[]
    total = result.count ?? rows.length
  }
  const page = Math.min(requestedPage, Math.max(1, Math.ceil(total / PAGE_SIZE)))

  const { data: profiles } = await supabase.from("profiles").select("id, display_name, email")
  const names = new Map(
    (profiles ?? []).map((actor) => [actor.id, actor.display_name || actor.email || "User"]),
  )
  const userOptions = [
    { value: "system", label: "System" },
    ...[...names.entries()].map(([value, label]) => ({ value, label })),
  ].sort((a, b) => a.label.localeCompare(b.label))
  const moduleOptions = Object.entries(moduleLabels)
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const activity: ActivityRow[] = rows.map((row) => {
    const verb =
      row.action === "insert" ? "Added" : row.action === "delete" ? "Deleted" : "Updated"
    const label = row.record_label?.trim()
    const what =
      row.action === "export" ? row.summary : label ? `${verb} ${label}` : row.summary
    return {
      id: row.id,
      when: formatWhen(row.created_at),
      whenIso: dhakaDate(row.created_at),
      createdAt: row.created_at,
      who: row.actor_id ? (names.get(row.actor_id) ?? "User") : "System",
      what,
      record: label || (moduleLabels[row.module] ?? fieldLabel(row.module)),
      action: row.action,
      module: row.module,
      moduleLabel: moduleLabels[row.module] ?? fieldLabel(row.module),
      changes: diffLines(row.old_values ?? null, row.new_values ?? null),
    }
  })

  return (
    <div className="flex flex-col gap-3.5">
      {loadError ? (
        <>
          <PageHeader title="Activity Log" eyebrow="Admin" className="mb-0 md:mb-2" />
          <p role="alert" className="text-sm text-destructive">
            Could not load the activity log.
          </p>
        </>
      ) : (
        <ActivityLog
          rows={activity}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
          filters={filters}
          moduleOptions={moduleOptions}
          userOptions={userOptions}
        />
      )}
    </div>
  )
}

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(date)
  return `${formatDayMonYear(dhakaDate(value))}, ${time}`
}

// The server may run in UTC (Vercel), so pin dates and times to the office time zone.
function dhakaDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value.slice(0, 10)
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Dhaka",
  }).format(date)
}

function fieldLabel(key: string) {
  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

const MONEY_FIELD = /amount|total|value|price|salary|allowance|bonus|deduction|cost|budget|balance|paid|due/

function displayValue(value: Json | undefined, key = ""): string {
  if (value === undefined || value === null || value === "") return "—"
  if (typeof value === "string") {
    return value.length > 80 ? `${value.slice(0, 77)}...` : value
  }
  if (typeof value === "number") return MONEY_FIELD.test(key) ? formatMoney(value) : value.toLocaleString("en-IN")
  if (typeof value === "boolean") return value ? "Yes" : "No"
  const text = JSON.stringify(value)
  return text.length > 80 ? `${text.slice(0, 77)}...` : text
}

function asRecord(value: Json | null): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value
}

function diffLines(oldValues: Json | null, newValues: Json | null): ActivityChange[] {
  const previous = asRecord(oldValues)
  const next = asRecord(newValues)
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(next)])].filter(
    (key) => !hiddenField(key),
  )

  return keys.flatMap((key) => {
    // Names only: never show raw record ids, even in free-form columns.
    if (isUuidValue(previous[key]) || isUuidValue(next[key])) return []
    const before = displayValue(previous[key], key)
    const after = displayValue(next[key], key)
    if (before === after) return []
    return [{ label: fieldLabel(key), before, after }]
  })
}

// Internal columns that mean nothing to a reader (ids, keys and timestamps).
const HIDDEN_FIELDS = new Set(["id", "created_at", "updated_at", "last_sign_in_at", "created_by", "updated_by"])

function hiddenField(key: string) {
  return HIDDEN_FIELDS.has(key) || key.endsWith("_id")
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUuidValue(value: Json | undefined) {
  return typeof value === "string" && UUID_PATTERN.test(value)
}
