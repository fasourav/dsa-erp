"use client"

import { useSyncExternalStore } from "react"

import type { ColumnStore } from "@/lib/column-visibility-store"

export function useColumnVisibility<T>(store: ColumnStore<T>): T {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  )
}
