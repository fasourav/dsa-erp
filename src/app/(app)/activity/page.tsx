import { ActivityLog, type ActivityRow } from "@/app/(app)/activity/activity-log"
import { requireOwner } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { fetchAllPages } from "@/lib/fetch-pages"
import { formatDayMonYear } from "@/lib/format"

export const metadata = { title: "Activity Log" }

export default async function ActivityPage() {
  await requireOwner()
  const supabase = await createClient()
  let rows: {
    id: string
    action: string
    module: string
    summary: string
    created_at: string
    actor_id: string | null
  }[] = []
  let loadError: string | null = null

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
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Could not load the activity log."
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

  const activity: ActivityRow[] = rows.map((row) => ({
    id: row.id,
    when: formatWhen(row.created_at),
    who: row.actor_id ? (names.get(row.actor_id) ?? "User") : "System",
    what: row.summary,
    action: row.action,
    module: row.module,
  }))

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

function formatWhen(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
  return `${formatDayMonYear(value.slice(0, 10))}, ${time}`
}
