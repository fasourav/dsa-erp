import {
  COLUMN_STORAGE_KEY,
  defaultColumnVisibility,
  sanitizeColumnVisibility,
  type ColumnVisibility,
} from "@/lib/purchase-order-summary"

const serverSnapshot = defaultColumnVisibility()
const listeners = new Set<() => void>()

let cachedRaw: string | null | undefined
let cachedVisibility: ColumnVisibility = serverSnapshot

export function subscribeColumnVisibility(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getColumnSnapshot(): ColumnVisibility {
  const raw = readRaw()
  if (raw === cachedRaw) {
    return cachedVisibility
  }

  cachedRaw = raw
  cachedVisibility = parseRaw(raw)
  return cachedVisibility
}

export function getColumnServerSnapshot(): ColumnVisibility {
  return serverSnapshot
}

export function writeColumnVisibility(visibility: ColumnVisibility) {
  const raw = JSON.stringify(visibility)

  try {
    sessionStorage.setItem(COLUMN_STORAGE_KEY, raw)
  } catch {
    // The choice still applies in this tab when storage is blocked.
  }

  cachedRaw = raw
  cachedVisibility = visibility
  listeners.forEach((listener) => listener())
}

function readRaw(): string | null {
  try {
    return sessionStorage.getItem(COLUMN_STORAGE_KEY)
  } catch {
    return null
  }
}

function parseRaw(raw: string | null): ColumnVisibility {
  if (!raw) {
    return serverSnapshot
  }

  try {
    return sanitizeColumnVisibility(JSON.parse(raw))
  } catch {
    return serverSnapshot
  }
}
