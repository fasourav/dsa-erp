"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"

import { type SortState, toggleSort } from "@/lib/list-paging"
import {
  facetQueryValue,
  parseFacetParam,
  parsePageParams,
  parseSortParams,
  sortQueryParams,
} from "@/lib/page-query"
import {
  parseSettlementFilter,
  type SettlementFilter,
  settlementQueryValue,
} from "@/lib/settlement-filter"

export type ListFacetConfig = {
  key: string
  options: readonly string[]
  defaultValue?: string
}

export type UseListUrlStateOptions<ColumnId extends string> = {
  sortKeys: readonly ColumnId[]
  defaultSort: SortState<ColumnId>
  facet?: ListFacetConfig
  settlement?: boolean
  navigation?: "history" | "router"
  debounceMs?: number
}

const EMPTY_OPTIONS: readonly string[] = []

export function useListUrlState<ColumnId extends string>({
  sortKeys,
  defaultSort,
  facet: facetConfig,
  settlement: settlementEnabled = false,
  navigation = "history",
  debounceMs = 300,
}: UseListUrlStateOptions<ColumnId>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { page: urlPage, q: urlQuery } = parsePageParams({
    page: searchParams.get("page") ?? undefined,
    q: searchParams.get("q") ?? undefined,
  })

  const sort = parseSortParams<ColumnId>(
    {
      sort: searchParams.get("sort") ?? undefined,
      dir: searchParams.get("dir") ?? undefined,
    },
    sortKeys,
    defaultSort,
  )

  const facetKey = facetConfig?.key ?? null
  const facetDefault = facetConfig?.defaultValue ?? "all"
  const facetOptions = facetConfig?.options ?? EMPTY_OPTIONS
  const facet = facetKey
    ? parseFacetParam(
        searchParams.get(facetKey) ?? undefined,
        facetOptions,
        facetDefault,
      )
    : facetDefault

  const settlement: SettlementFilter = settlementEnabled
    ? parseSettlementFilter(searchParams.get("status") ?? undefined)
    : "outstanding"

  const [queryState, setQueryState] = useState(() => ({
    prevUrlQuery: urlQuery,
    committed: urlQuery,
    value: urlQuery,
  }))

  if (queryState.prevUrlQuery !== urlQuery) {
    setQueryState((prev) => ({
      prevUrlQuery: urlQuery,
      committed: urlQuery,
      value: prev.committed === urlQuery ? prev.value : urlQuery,
    }))
  }

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
    }
  }, [])

  const writeParams = useCallback(
    (
      updates: Record<string, string | null | undefined>,
      options?: { keepPage?: boolean },
    ) => {
      const params = new URLSearchParams(window.location.search)
      for (const [key, value] of Object.entries(updates)) {
        const trimmed = value?.trim()
        if (trimmed) {
          params.set(key, trimmed)
        } else {
          params.delete(key)
        }
      }
      if (!options?.keepPage && !("page" in updates)) {
        params.delete("page")
      }
      const qs = params.toString()
      const nextUrl = qs ? `${pathname}?${qs}` : pathname
      if (navigation === "router") {
        startTransition(() => {
          router.replace(nextUrl, { scroll: false })
        })
      } else {
        window.history.replaceState(null, "", nextUrl)
      }
    },
    [navigation, pathname, router],
  )

  const setQuery = useCallback(
    (next: string) => {
      setQueryState((prev) => ({ ...prev, value: next }))
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        const { q: committed } = parsePageParams({ q: next })
        const current = parsePageParams({
          q: new URLSearchParams(window.location.search).get("q") ?? undefined,
        }).q
        setQueryState((prev) =>
          prev.value === next
            ? { ...prev, committed, value: committed }
            : { ...prev, committed },
        )
        if (committed === current) {
          return
        }
        writeParams({ q: committed || null })
      }, debounceMs)
    },
    [debounceMs, writeParams],
  )

  const setFacet = useCallback(
    (next: string) => {
      if (!facetKey) return
      const valid = parseFacetParam(next, facetOptions, facetDefault)
      writeParams({ [facetKey]: facetQueryValue(valid, facetDefault) })
    },
    [facetDefault, facetKey, facetOptions, writeParams],
  )

  const setSettlement = useCallback(
    (next: SettlementFilter) => {
      const valid = parseSettlementFilter(next)
      writeParams({ status: settlementQueryValue(valid) })
    },
    [writeParams],
  )

  const setSort = useCallback(
    (next: SortState<ColumnId>) => {
      const valid = parseSortParams<ColumnId>(
        { sort: next.key, dir: next.direction },
        sortKeys,
        defaultSort,
      )
      writeParams(sortQueryParams(valid, defaultSort))
    },
    [defaultSort, sortKeys, writeParams],
  )

  const onSort = useCallback(
    (key: ColumnId) => {
      const next = toggleSort(sort, key)
      const valid = parseSortParams<ColumnId>(
        { sort: next.key, dir: next.direction },
        sortKeys,
        defaultSort,
      )
      writeParams(sortQueryParams(valid, defaultSort))
    },
    [defaultSort, sort, sortKeys, writeParams],
  )

  const setPage = useCallback(
    (nextPage: number) => {
      const safePage =
        Number.isFinite(nextPage) && Math.floor(nextPage) > 1
          ? String(Math.floor(nextPage))
          : null
      writeParams({ page: safePage }, { keepPage: true })
    },
    [writeParams],
  )

  const clearFilters = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setQueryState((prev) => ({ ...prev, committed: "", value: "" }))
    const updates: Record<string, string | null> = { q: null }
    if (facetKey) {
      updates[facetKey] = null
    }
    if (settlementEnabled) {
      updates.status = null
    }
    writeParams(updates)
  }, [facetKey, settlementEnabled, writeParams])

  const query = queryState.value
  const committedQuery = parsePageParams({ q: query }).q
  const page = committedQuery === urlQuery ? urlPage : 1
  const hasActiveFilters =
    Boolean(committedQuery) ||
    (Boolean(facetKey) && facet !== facetDefault) ||
    (settlementEnabled && settlement !== "outstanding")

  return {
    query,
    setQuery,
    facet,
    setFacet,
    settlement,
    setSettlement,
    sort,
    setSort,
    onSort,
    page,
    setPage,
     setParams: writeParams,
    clearFilters,
    hasActiveFilters,
  }
}
