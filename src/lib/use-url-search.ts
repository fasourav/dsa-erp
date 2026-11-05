"use client"

import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"

export function useUrlSearch(initialQuery = "", debounceMs = 300) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
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
        if (trimmed) {
          params.set("q", trimmed)
        } else {
          params.delete("q")
        }
        params.delete("page")
        const qs = params.toString()
        startTransition(() => {
          router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
          setState((prev) =>
            prev.value === next
              ? { synced: trimmed, value: next, dirty: false }
              : prev,
          )
        })
      }, debounceMs)
    },
    [debounceMs, initialQuery, pathname, router],
  )

  const setPage = useCallback(
    (nextPage: number) => {
      const params = new URLSearchParams(window.location.search)
      if (nextPage > 1) {
        params.set("page", String(Math.floor(nextPage)))
      } else {
        params.delete("page")
      }
      const qs = params.toString()
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router],
  )

  const setParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
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
      const qs = params.toString()
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [pathname, router],
  )

  return { query, setQuery, setPage, setParams }
}
