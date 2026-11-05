export const LIST_PAGE_SIZE = 50

export type PageParams = {
  page: number
  q: string
}

export function parsePageParams(
  params: Record<string, string | string[] | undefined>,
  maxQueryLength = 100,
): PageParams {
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const parsedPage = Number(rawPage)
  const page =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1

  const rawQuery = Array.isArray(params.q) ? params.q[0] : params.q
  const q = (rawQuery ?? "").trim().slice(0, Math.max(0, maxQueryLength))

  return { page, q }
}

export function pageRange(
  page: number,
  pageSize: number = LIST_PAGE_SIZE,
): { from: number; to: number } {
  const safeSize =
    Number.isFinite(pageSize) && pageSize >= 1
      ? Math.floor(pageSize)
      : LIST_PAGE_SIZE
  const safePage =
    Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1
  const from = (safePage - 1) * safeSize
  return { from, to: from + safeSize - 1 }
}

/**
 * Strips PostgREST `.or(...)` structural delimiters and LIKE wildcards
 * (`%`, `_`, `\`, `,`, `(`, `)`, `"`) while preserving apostrophes (`'` / `’`)
 * so names such as `O'Brien` or `Cox's Bazar` remain searchable.
 * PostgREST binds all filter values as prepared-statement parameters.
 */
export function sanitizeSearch(raw: string, maxLength = 100): string {
  return raw
    .slice(0, Math.max(0, maxLength))
    .replace(/[%_\\,()"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function parseSearchIsoDate(value: string): string | null {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null
  const [year, month, day] = trimmed.split("-").map(Number)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const check = new Date(Date.UTC(year, month - 1, day))
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    return null
  }
  return trimmed
}

export function parseSearchAmount(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/^(?:bdt|tk|৳|\$)\s*/i, "")
    .replace(/,/g, "")
    .trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) return null
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) ? parsed : null
}

export function buildPageHref(
  basePath: string,
  targetPage: number,
  params?: Record<string, string | null | undefined>,
): string {
  const search = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (key === "page") continue
      const trimmed = value?.trim()
      if (trimmed) {
        search.set(key, trimmed)
      }
    }
  }
  if (Number.isFinite(targetPage) && Math.floor(targetPage) > 1) {
    search.set("page", String(Math.floor(targetPage)))
  }
  const qs = search.toString()
  return qs ? `${basePath}?${qs}` : basePath
}
