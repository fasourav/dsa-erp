"use client"

import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"

import { normalizePageSizeParam } from "@/lib/page-query"

export function useUrlSearch(
  initialQuery = "",
  debounceMs = 300,
  pageSize?: { options: readonly number[]; fallback: number },
) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const sizeOptions = pageSize?.options
  const sizeFallback = pageSize?.fallback
  const [state, setState] = useState(() => ({
    synced: initialQuery,
    value: initialQuery,
    dirty: false,
  }))
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const query =
    !state.dirty && state.synced !== initialQuery ? initialQuery : state.value

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const setQuery = useCallback(
    (next: string) => {
      setState({ synced: initialQuery, value: next, dirty: true })
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        const trimmed = next.trim()
        const params = new URLSearchParams(window.location.search)
        const current = (params.get("q") ?? "").trim()
        // Whitespace-only edits do not change the committed search, so keep
        // the page. The field stores the trimmed value so it matches the URL.
        if (trimmed === current) {
          setState((prev) =>
            prev.value === next
              ? { synced: trimmed, value: trimmed, dirty: false }
              : prev,
          )
          return
        }
        if (trimmed) {
          params.set("q", trimmed)
        } else {
          params.delete("q")
        }
        params.delete("page")
        if (sizeOptions && sizeFallback !== undefined) {
          normalizePageSizeParam(params, sizeOptions, sizeFallback)
        }
        const qs = params.toString()
        startTransition(() => {
          router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
          setState((prev) =>
            prev.value === next
              ? { synced: trimmed, value: trimmed, dirty: false }
              : prev,
          )
        })
      }, debounceMs)
    },
    [debounceMs, initialQuery, pathname, router, sizeFallback, sizeOptions],
  )

  const setPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(window.location.search)
      if (nextPage > 1) {
        params.set("page", String(Math.floor(nextPage)))
      } else {
        params.delete("page")
      }
      if (sizeOptions && sizeFallback !== undefined) {
        normalizePageSizeParam(params, sizeOptions, sizeFallback)
      }
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router, sizeFallback, sizeOptions],
  )

  const setParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      if ("q" in updates) {
        if (timerRef.current !== null) {
          clearTimeout(timerRef.current)
          timerRef.current = null
        }
        const nextQ = updates.q?.trim() ?? ""
        setState({ synced: nextQ, value: nextQ, dirty: false })
      }
      const params = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(updates)) {
        const trimmed = value?.trim()
        if (trimmed) {
          params.set(key, trimmed)
        } else {
          params.delete(key)
        }
      }
      if (!("page" in updates)) {
        params.delete("page")
      }
      if (sizeOptions && sizeFallback !== undefined) {
        normalizePageSizeParam(params, sizeOptions, sizeFallback)
      }
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router, sizeFallback, sizeOptions],
  )

  return { query, setQuery, setPage, setParams }
}
