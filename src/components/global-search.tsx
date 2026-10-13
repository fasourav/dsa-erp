"use client"

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

import { searchRecords } from "@/app/(app)/search/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SearchHit } from "@/lib/search"
import { cn } from "@/lib/utils"

const emptyResults: SearchHit[] = []

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
    function onKeyDown(event: KeyboardEvent) {
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

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
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

  let flatIndex = -1

  return (
    <>
      <Button type="button" variant="outline" size="lg" aria-label="Search" onClick={openPalette}>
        <Search aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Search</span>
        <span className="hidden text-muted-foreground md:inline">{shortcut}</span>
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
        <DialogContent className="overflow-hidden sm:max-w-lg">
          <DialogHeader className="pr-12">
            <DialogTitle>Search</DialogTitle>
            <div className="flex flex-col gap-2">
              <Label htmlFor={searchId}>Search Records</Label>
              <Input
                id={searchId}
                value={query}
                autoFocus
                placeholder="Names, notes, or amounts"
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onInputKeyDown}
              />
            </div>
          </DialogHeader>
          <DialogBody className="flex max-h-[50dvh] flex-col gap-3">
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {query.trim().length < 2 ? (
              <p className="text-sm text-muted-foreground">Type At Least Two Characters.</p>
            ) : pending && visibleResults.length === 0 && !error ? (
              <p className="text-sm text-muted-foreground">Searching…</p>
            ) : visibleResults.length === 0 && !error ? (
              <p className="text-sm text-muted-foreground">No Matching Records.</p>
            ) : (
              groups.map(([moduleLabel, hits]) => (
                <section key={moduleLabel} className="flex flex-col gap-1">
                  <h2 className="px-2 text-sm font-medium text-muted-foreground">{moduleLabel}</h2>
                  {hits.map((hit) => {
                    flatIndex += 1
                    const index = flatIndex
                    return (
                      <Link
                        key={`${hit.moduleKey}-${hit.recordId}-${hit.label}-${index}`}
                        href={hit.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex flex-col gap-0.5 rounded-lg px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                          index === active && "bg-accent text-accent-foreground",
                        )}
                      >
                        <span className="font-medium">{hit.label}</span>
                        {hit.detail ? (
                          <span className="text-muted-foreground">{hit.detail}</span>
                        ) : null}
                      </Link>
                    )
                  })}
                </section>
              ))
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
