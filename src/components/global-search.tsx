"use client"

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileText, Search, type LucideIcon } from "lucide-react"

import { searchRecords } from "@/app/(app)/search/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Label } from "@/components/ui/label"
import { navIcons } from "@/lib/nav-icons"
import type { SearchHit } from "@/lib/search"
import { cn } from "@/lib/utils"

const emptyResults: SearchHit[] = []

const moduleHref: Record<string, string> = {
  clients: "/clients",
  leads: "/leads",
  projects: "/projects",
  vendors: "/vendors",
  employees: "/hr/employees",
  client_invoices: "/accounts/invoices",
  vendor_invoices: "/purchase-orders",
  purchase_orders: "/purchase-orders",
  assets: "/assets",
  banking: "/accounts/bank",
}

function iconFor(moduleKey: string): LucideIcon {
  const href = moduleHref[moduleKey]
  return (href && navIcons[href]) || FileText
}

export function GlobalSearch() {
  const router = useRouter()
  const searchId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchHit[]>([])
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState(0)
  const shortcut = "Ctrl K"
  const [pending, startTransition] = useTransition()
  const requestId = useRef(0)

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(true)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return
    const trimmed = query.trim()
    if (trimmed.length < 2) return

    const current = requestId.current + 1
    requestId.current = current
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        const response = await searchRecords(trimmed)
        if (requestId.current !== current) return
        setResults(response.results)
        setError(response.error)
        setActive(0)
      })
    }, 250)

    return () => window.clearTimeout(timer)
  }, [open, query])

  const trimmed = query.trim()
  const visibleResults = trimmed.length < 2 ? emptyResults : results
  const groups = useMemo(() => {
    const map = new Map<string, SearchHit[]>()
    for (const hit of visibleResults) {
      const list = map.get(hit.moduleLabel) ?? []
      list.push(hit)
      map.set(hit.moduleLabel, list)
    }
    return [...map.entries()]
  }, [visibleResults])

  function openPalette() {
    setOpen(true)
  }

  function go(hit: SearchHit) {
    setOpen(false)
    router.push(hit.href)
  }

  function onInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActive((current) => Math.min(current + 1, Math.max(visibleResults.length - 1, 0)))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((current) => Math.max(current - 1, 0))
    } else if (event.key === "Enter" && visibleResults[active]) {
      event.preventDefault()
      go(visibleResults[active])
    }
  }

  let cursor = 0
  const grouped = groups.map(([moduleLabel, hits]) => ({
    moduleLabel,
    rows: hits.map((hit) => {
      const index = cursor
      cursor += 1
      return { hit, index }
    }),
  }))

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Search"
        aria-keyshortcuts="Control+K Meta+K"
        className="md:h-8 md:w-60 md:justify-start md:gap-2 md:bg-fill md:px-3.5 md:font-normal md:text-muted-foreground md:shadow-none md:backdrop-blur-none md:hover:bg-fill-strong"
        onClick={openPalette}
      >
        <Search aria-hidden="true" className="size-4.5 md:size-4" />
        <span className="hidden md:inline">Search</span>
        <kbd className="ml-auto hidden font-sans text-caption text-subtle-foreground md:inline">
          {shortcut}
        </kbd>
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setQuery("")
            setResults([])
            setError(null)
          }
        }}
      >
        <DialogContent className="overflow-hidden sm:max-w-lg md:max-w-xl">
          <DialogHeader className="gap-3">
            <DialogTitle className="sr-only">Search</DialogTitle>
            <Label htmlFor={searchId} className="sr-only">
              Search records
            </Label>
            <InputGroup>
              <InputGroupAddon>
                <Search aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                id={searchId}
                value={query}
                autoFocus
                type="search"
                enterKeyHint="search"
                autoComplete="off"
                placeholder="Names, notes, or amounts"
                className="text-base md:text-base"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
              />
            </InputGroup>
          </DialogHeader>
          <DialogBody className="flex min-h-0 flex-1 flex-col gap-4">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {trimmed.length < 2 ? (
              <p className="px-1 py-6 text-center text-label text-muted-foreground">
                Type at least two characters.
              </p>
            ) : pending && visibleResults.length === 0 && !error ? (
              <p className="px-1 py-6 text-center text-label text-muted-foreground">Searching…</p>
            ) : visibleResults.length === 0 && !error ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Search aria-hidden="true" />
                  </EmptyMedia>
                  <EmptyTitle>No Matching Records</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              grouped.map((group) => (
                <section key={group.moduleLabel} className="flex flex-col gap-1">
                  <h2 className="px-2 text-caption font-semibold text-muted-foreground">
                    {group.moduleLabel}
                  </h2>
                  <ul className="flex flex-col">
                    {group.rows.map(({ hit, index }) => {
                      const Icon = iconFor(hit.moduleKey)
                      return (
                        <li key={`${hit.moduleKey}-${hit.recordId}-${hit.label}-${index}`}>
                          <Link
                            href={hit.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 hover:bg-fill",
                              index === active && "bg-primary-tint hover:bg-primary-tint",
                            )}
                          >
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-fill text-foreground">
                              <Icon aria-hidden="true" className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-ui font-semibold">{hit.label}</span>
                              {hit.detail ? (
                                <span className="block truncate text-caption text-muted-foreground">
                                  {hit.detail}
                                </span>
                              ) : null}
                            </span>
                            {index === active ? (
                              <kbd className="hidden font-sans text-caption text-subtle-foreground md:inline">
                                Enter
                              </kbd>
                            ) : null}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
