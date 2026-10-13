import { ActivityLog, type ActivityRow } from "@/app/(app)/activity/activity-log"
import { requireOwner } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { fetchAllPages } from "@/lib/fetch-pages"
import { formatDayMonYear } from "@/lib/format"
import type { Json } from "@/types/database.types"

export const metadata = { title: "Activity Log" }

const moduleLabels: Record<string, string> = {
  dashboard: "Dashboard",
  leads: "Leads",
  clients: "Clients",
  projects: "Projects",
  backlog: "Backlog",
  purchase_orders: "Purchase Orders",
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

export default async function ActivityPage() {
  await requireOwner()
  const supabase = await createClient()
  let rows: ActivityRecord[] = []
  let loadError: string | null = null

  try {
    rows = await fetchAllPages(
      (from, to) =>
        supabase
          .from("activity_log")
          .select(
            "id, action, module, summary, created_at, actor_id, record_label, old_values, new_values",
          )
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      "Activity log is larger than expected.",
    )
  } catch (error) {
    const message = readError(error)
    if (/record_label|old_values|new_values|schema cache/i.test(message)) {
      try {
        rows = await fetchAllPages(
          (from, to) =>
            supabase
              .from("activity_log")
              .select("id, action, module, summary, created_at, actor_id")
              .order("created_at", { ascending: false })
              .order("id", { ascending: false })
              .range(from, to),
          "Activity log is larger than expected.",
        )
      } catch (fallbackError) {
        loadError = readError(fallbackError) || "Could not load the activity log."
      }
    } else {
      loadError = message || "Could not load the activity log."
    }
  }

  const actorIds = [
    ...new Set(rows.map((row) => row.actor_id).filter((id): id is string => Boolean(id))),
  ]
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", actorIds)
    : { data: [] as { id: string; display_name: string | null; email: string | null }[] }

  const names = new Map(
    (actors ?? []).map((actor) => [actor.id, actor.display_name || actor.email || "User"]),
  )

  const activity: ActivityRow[] = rows.map((row) => {
    const verb =
      row.action === "insert" ? "Added" : row.action === "delete" ? "Deleted" : "Updated"
    const label = row.record_label?.trim()
    return {
      id: row.id,
      when: formatWhen(row.created_at),
      whenIso: dhakaDate(row.created_at),
      who: row.actor_id ? (names.get(row.actor_id) ?? "User") : "System",
      what: label ? `${verb} ${label}` : row.summary,
      action: row.action,
      module: row.module,
      moduleLabel: moduleLabels[row.module] ?? fieldLabel(row.module),
      changes: diffLines(row.old_values ?? null, row.new_values ?? null),
    }
  })

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Admin / Activity Log</p>
        <h1 className="text-2xl font-medium tracking-tight">Activity Log</h1>
      </div>
      {loadError ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load the activity log.
        </p>
      ) : (
        <ActivityLog rows={activity} />
      )}
    </div>
  )
}

function readError(error: unknown) {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message
  }
  return ""
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

function displayValue(value: Json | undefined): string {
  if (value === undefined || value === null || value === "") return "—"
  if (typeof value === "string") {
    return value.length > 80 ? `${value.slice(0, 77)}...` : value
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  const text = JSON.stringify(value)
  return text.length > 80 ? `${text.slice(0, 77)}...` : text
}

function asRecord(value: Json | null): Record<string, Json | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value
}

function diffLines(oldValues: Json | null, newValues: Json | null): string[] {
  const previous = asRecord(oldValues)
  const next = asRecord(newValues)
  const keys = [...new Set([...Object.keys(previous), ...Object.keys(next)])].filter(
    (key) => !hiddenField(key),
  )

  return keys.flatMap((key) => {
    // Names only: never show raw record ids, even in free-form columns.
    if (isUuidValue(previous[key]) || isUuidValue(next[key])) return []
    const from = displayValue(previous[key])
    const to = displayValue(next[key])
    if (from === to) return []
    return [`${fieldLabel(key)}: ${from} to ${to}`]
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
