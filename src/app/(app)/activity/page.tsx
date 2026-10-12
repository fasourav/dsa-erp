import { requireOwner } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { formatDayMonYear } from "@/lib/format"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export const metadata = { title: "Activity Log" }

export default async function ActivityPage() {
  await requireOwner()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, action, summary, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(200)

  const actorIds = [...new Set((data ?? []).map((row) => row.actor_id).filter((id): id is string => Boolean(id)))]
  const { data: actors } = actorIds.length
    ? await supabase.from("profiles").select("id, display_name, email").in("id", actorIds)
    : { data: [] as { id: string; display_name: string | null; email: string | null }[] }

  const names = new Map(
    (actors ?? []).map((actor) => [actor.id, actor.display_name || actor.email || "User"]),
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Admin / Activity Log</p>
        <h1 className="text-2xl font-medium tracking-tight">Activity Log</h1>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          Could not load the activity log.
        </p>
      ) : null}
      <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted hover:bg-muted">
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>What</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data ?? []).length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={3} className="py-8 text-center whitespace-normal text-muted-foreground">
                  No Activity Yet.
                </TableCell>
              </TableRow>
            ) : (
              (data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">{formatWhen(row.created_at)}</TableCell>
                  <TableCell>{row.actor_id ? (names.get(row.actor_id) ?? "User") : "System"}</TableCell>
                  <TableCell className="whitespace-normal">{row.summary}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
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
