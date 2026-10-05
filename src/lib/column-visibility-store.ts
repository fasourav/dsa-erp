export type ColumnStore<T> = {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => T
  getServerSnapshot: () => T
  write: (visibility: T) => void
}

export function createColumnStore<T>(
  storageKey: string,
  fallback: T,
  sanitize: (value: unknown) => T,
): ColumnStore<T> {
  const listeners = new Set<() => void>()
  let cachedRaw: string | null | undefined
  let cachedVisibility: T = fallback

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getSnapshot() {
      const raw = readRaw(storageKey)
      if (raw === cachedRaw) {
        return cachedVisibility
      }

      cachedRaw = raw
      cachedVisibility = parseRaw(raw, fallback, sanitize)
      return cachedVisibility
    },
    getServerSnapshot() {
      return fallback
    },
    write(visibility) {
      const raw = JSON.stringify(visibility)

      try {
        sessionStorage.setItem(storageKey, raw)
      } catch {
        // The choice still applies in this tab when storage is blocked.
      }

      cachedRaw = raw
      cachedVisibility = visibility
      listeners.forEach((listener) => listener())
    },
  }
}

function readRaw(storageKey: string): string | null {
  try {
    return sessionStorage.getItem(storageKey)
  } catch {
    return null
  }
}

function parseRaw<T>(
  raw: string | null,
  fallback: T,
  sanitize: (value: unknown) => T,
): T {
  if (!raw) {
    return fallback
  }

  try {
    return sanitize(JSON.parse(raw))
  } catch {
    return fallback
  }
}
