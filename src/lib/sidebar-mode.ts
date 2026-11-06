import { createColumnStore, type ColumnStore } from "@/lib/column-visibility-store"

export type SidebarMode = "auto" | "open" | "closed"

export const SIDEBAR_MODES: readonly SidebarMode[] = ["auto", "open", "closed"]

export function sanitizeSidebarMode(value: unknown): SidebarMode {
  return SIDEBAR_MODES.includes(value as SidebarMode) ? (value as SidebarMode) : "auto"
}

export function sidebarModeKey(email: string): string {
  const account = email.trim().toLowerCase() || "anonymous"
  return `dsa-erp.sidebar.mode:${account}`
}

const stores = new Map<string, ColumnStore<SidebarMode>>()

export function sidebarModeStore(email: string): ColumnStore<SidebarMode> {
  const key = sidebarModeKey(email)
  let store = stores.get(key)
  if (!store) {
    store = createColumnStore<SidebarMode>(key, "auto", sanitizeSidebarMode)
    stores.set(key, store)
  }
  return store
}

export function sidebarExpanded(state: {
  mode: SidebarMode
  pointerInside: boolean
  focusInside: boolean
  menuOpen: boolean
}): boolean {
  if (state.mode === "open") return true
  if (state.mode === "closed") return false
  return state.pointerInside || state.focusInside || state.menuOpen
}

export function sidebarModeLabel(mode: SidebarMode): string {
  if (mode === "open") return "Always expanded"
  if (mode === "closed") return "Always collapsed"
  return "Auto"
}
