"use client"

import { usePathname, useRouter } from "next/navigation"
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react"

import { DataList } from "@/components/data-list"
import { ListExport } from "@/components/list-export"
import { ListSearch } from "@/components/list-search"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDayMonYear } from "@/lib/format"
import {
  rangeLabel,
  toggleSort,
  type ListColumn,
  type SortState,
} from "@/lib/list-paging"


export type ActivityChange = {
  label: string
  before: string
  after: string
}

export type ActivityRow = {
  id: string
  when: string
  whenIso: string
  createdAt: string
  who: string
  what: string
  record: string
  action: string
  module: string
  moduleLabel: string
  changes: ActivityChange[]
}

type ColumnId = "when" | "who" | "action" | "record"

const columns: readonly ListColumn<ColumnId>[] = [
  { id: "when", label: "When", align: "left", locked: true },
  { id: "who", label: "Who", align: "left", locked: true },
  { id: "action", label: "Action", align: "left", locked: true },
  { id: "record", label: "Record", align: "left", locked: true },
]

type ActionTab = "all" | "creates" | "edits" | "deletes"

export type ActivityFilters = {
  q: string
  module: string
  user: string
  from: string
  to: string
  action: string
}

type Option = { value: string; label: string }

export function ActivityLog({
  rows,
  total,
  page,
  pageSize,
  filters,
  moduleOptions,
  userOptions,
}: {
  rows: ActivityRow[]
  total: number
  page: number
  pageSize: number
  filters: ActivityFilters
  moduleOptions: Option[]
  userOptions: Option[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [pending, startTransition] = useTransition()
  const [query, setQuery] = useState(filters.q)
  const [sort, setSort] = useState<SortState<ColumnId>>({
    key: "when",
    direction: "desc",
  })
  const [diff, setDiff] = useState<ActivityRow | null>(null)
  const actionTab: ActionTab =
    filters.action === "creates" || filters.action === "edits" || filters.action === "deletes"
      ? filters.action
      : "all"

  // Filters live in the URL so the server returns one page (50 rows) at a time.
  const navigate = (patch: Partial<ActivityFilters> & { page?: number }) => {
    const next = { ...filters, ...patch }
    const params = new URLSearchParams()
    if (next.q) params.set("q", next.q)
    if (next.module !== "all") params.set("module", next.module)
    if (next.user !== "all") params.set("user", next.user)
    if (next.from) params.set("from", next.from)
    if (next.to) params.set("to", next.to)
    if (next.action !== "all") params.set("action", next.action)
    const target = patch.page ?? 1
    if (target > 1) params.set("page", String(target))
    const search = params.toString()
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }))
  }
  const navigateRef = useRef(navigate)
  useEffect(() => {
    navigateRef.current = navigate
  })

  useEffect(() => {
    if (query.trim() === filters.q) return
    const timer = setTimeout(() => navigateRef.current({ q: query.trim() }), 350)
    return () => clearTimeout(timer)
  }, [query, filters.q])

  // Newest first comes from the server; other column sorts reorder the current page.
  const sorted = rows.slice().sort((left, right) => {
    let cmp = 0
    switch (sort.key) {
      case "when":
        cmp = left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
        break
      case "who":
        cmp = left.who.localeCompare(right.who, "en", { sensitivity: "base" })
        break
      case "action":
        cmp = left.what.localeCompare(right.what, "en", { sensitivity: "base" })
        break
      case "record":
        cmp = left.record.localeCompare(right.record, "en", { sensitivity: "base" })
        break
    }
    return sort.direction === "asc" ? cmp : -cmp
  })

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1
  const rangeEnd = total === 0 ? 0 : rangeStart + rows.length - 1
  const hasFilters =
    Boolean(filters.q) ||
    filters.module !== "all" ||
    filters.user !== "all" ||
    Boolean(filters.from) ||
    Boolean(filters.to) ||
    filters.action !== "all"
  const emptyMessage = hasFilters ? "No Matching Activity." : "No Activity Yet."

  return (
    <div className="flex flex-col gap-3.5" aria-busy={pending}>
      <PageHeader
        eyebrow="Admin"
        title="Activity Log"
        className="mb-0 md:mb-2"
        actions={
          <ListExport
            grid={{
              filename: "activity-log",
              title: "Activity Log",
              columns: [
                { header: "When", kind: "text" },
                { header: "Who", kind: "text" },
                { header: "What", kind: "text" },
                { header: "Module", kind: "text" },
              ],
              rows: sorted.map((row) => [row.when, row.who, row.what, row.moduleLabel]),
            }}
          />
        }
      />
      <ListSearch
        query={query}
        onQueryChange={(value) => {
          setQuery(value)
        }}
        placeholder="Search activity"
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FilterSelect
          label="Module"
          value={filters.module}
          onChange={(value) => navigate({ module: value })}
          options={[{ value: "all", label: "All Modules" }, ...moduleOptions]}
        />
        <FilterSelect
          label="User"
          value={filters.user}
          onChange={(value) => navigate({ user: value })}
          options={[{ value: "all", label: "All Users" }, ...userOptions]}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="activity-from">From</Label>
          <Input
            id="activity-from"
            type="date"
            value={filters.from}
            onChange={(event) => navigate({ from: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="activity-to">To</Label>
          <Input
            id="activity-to"
            type="date"
            value={filters.to}
            onChange={(event) => navigate({ to: event.target.value })}
          />
        </div>
      </div>
      <Tabs
        value={actionTab}
        onValueChange={(value) => {
          if (value === "all" || value === "creates" || value === "edits" || value === "deletes") {
            navigate({ action: value })
          }
        }}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="creates">Creates</TabsTrigger>
          <TabsTrigger value="edits">Edits</TabsTrigger>
          <TabsTrigger value="deletes">Deletes</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataList
        columns={columns}
        rows={sorted}
        rowKey={(row) => row.id}
        sort={sort}
        onSort={(key) => {
          setSort((current) => toggleSort(current, key))
        }}
        visibility={{}}
        error={null}
        emptyMessage={emptyMessage}
        rangeText={rangeLabel(
          rangeStart,
          rangeEnd,
          total,
          "event",
          "events",
        )}
        currentPage={page}
        pageCount={pageCount}
        onPageChange={(next) => navigate({ page: next })}
        pagingLabel="Activity pagination"
        mobileItem={(row) => ({
          title: row.what,
          subtitle: [row.who, row.record].filter(Boolean).join(" · "),
          value: <RelativeTime iso={row.createdAt} absolute={row.when} />,
        })}
        renderCell={(row, columnId) => {
          switch (columnId) {
            case "when":
              return <RelativeTime iso={row.createdAt} absolute={row.when} />
            case "who":
              return <span className="text-ui font-semibold">{row.who}</span>
            case "action":
              return row.changes.length > 0 ? (
                <Button
                  type="button"
                  variant="link"
                  className="px-0"
                  onClick={() => setDiff(row)}
                >
                  {row.what}
                </Button>
              ) : (
                <span>{row.what}</span>
              )
            case "record":
              return <span>{row.record || "—"}</span>
          }
        }}
        renderActions={(row) =>
          row.changes.length > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setDiff(row)}>
              Changes
            </Button>
          ) : null
        }
      />
      <Dialog open={diff !== null} onOpenChange={(open) => !open && setDiff(null)}>
        <DialogContent variant="drawer" className="overflow-hidden">
          <DialogHeader>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <DialogTitle>Changes</DialogTitle>
              {diff ? <DialogDescription>{diff.what}</DialogDescription> : null}
            </div>
          </DialogHeader>
          <DialogBody>
            {diff ? (
              <dl className="overflow-hidden rounded-card border border-border">
                {diff.changes.map((change, index) => (
                  <div
                    key={`${change.label}-${index}`}
                    className="border-t border-border px-4 py-3 first:border-t-0"
                  >
                    <dt className="text-label font-medium text-muted-foreground">{change.label}</dt>
                    <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <dd>
                        <p className="text-label text-muted-foreground">Before</p>
                        <p className="mt-0.5 break-words">{change.before}</p>
                      </dd>
                      <dd>
                        <p className="text-label text-muted-foreground">After</p>
                        <p className="mt-0.5 break-words">{change.after}</p>
                      </dd>
                    </div>
                  </div>
                ))}
              </dl>
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label>{label}</Label>
      <Select
        items={options}
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next)
        }}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function subscribeClock() {
  return () => {}
}

const relativeCache = new Map<string, string>()

function relativeSnapshot(iso: string, absolute: string) {
  const cached = relativeCache.get(iso)
  if (cached) return cached
  const next = relativeLabel(iso, absolute)
  relativeCache.set(iso, next)
  return next
}

function relativeLabel(iso: string, absolute: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return absolute
  const minutes = Math.round((Date.now() - date.getTime()) / 60000)
  if (minutes < 1) return "Just Now"
  if (minutes < 60) return minutes === 1 ? "1 Minute Ago" : `${minutes} Minutes Ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours === 1 ? "1 Hour Ago" : `${hours} Hours Ago`
  const days = Math.round(hours / 24)
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} Days Ago`
  const day = iso.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}/.test(day) ? formatDayMonYear(day) : absolute
}

function RelativeTime({ iso, absolute }: { iso: string; absolute: string }) {
  const label = useSyncExternalStore(
    subscribeClock,
    () => relativeSnapshot(iso, absolute),
    () => absolute,
  )
  return <span>{label}</span>
}
