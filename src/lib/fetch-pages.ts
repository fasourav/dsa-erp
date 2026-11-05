const PAGE_SIZE = 1000
const MAX_PAGES = 100

export async function fetchAllPages<T>(
  queryPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: { message: string } | null
  }>,
  overflowMessage: string,
): Promise<T[]> {
  const rows: T[] = []

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const from = page * PAGE_SIZE
    const { data, error } = await queryPage(from, from + PAGE_SIZE - 1)

    if (error) {
      throw error
    }

    const batch = data ?? []
    rows.push(...batch)

    if (batch.length < PAGE_SIZE) {
      return rows
    }
  }

  throw new Error(overflowMessage)
}

const ID_CHUNK = 100

export async function fetchByIds<T>(
  ids: readonly string[],
  load: (ids: string[]) => PromiseLike<{
    data: T[] | null
    error: { message: string } | null
  }>,
): Promise<T[]> {
  const unique = [...new Set(ids.filter((id) => id.length > 0))]
  const rows: T[] = []

  for (let index = 0; index < unique.length; index += ID_CHUNK) {
    const slice = unique.slice(index, index + ID_CHUNK)
    const { data, error } = await load(slice)

    if (error) {
      throw error
    }

    rows.push(...(data ?? []))
  }

  return rows
}

export type PageSlice<T> = {
  rows: T[]
  total: number
  page: number
  pageCount: number
}

export async function fetchPage<T>(
  queryRange: (from: number, to: number) => PromiseLike<{
    data: T[] | null
    error: { code?: string; message: string } | null
    count: number | null
  }>,
  requestedPage: number,
  pageSize = 50,
): Promise<PageSlice<T>> {
  const safeSize = Math.max(1, Math.floor(pageSize) || 50)
  const safeRequested = Math.max(1, Math.floor(requestedPage) || 1)
  const bounds = (target: number) => {
    const from = (target - 1) * safeSize
    return { from, to: from + safeSize - 1 }
  }

  const initial = bounds(safeRequested)
  let result = await queryRange(initial.from, initial.to)

  // Past the end (PostgREST answers PGRST103): reload page 1 for count, then last page.
  if (safeRequested > 1 && result.error?.code === "PGRST103") {
    const first = bounds(1)
    result = await queryRange(first.from, first.to)
    const lastPage = Math.max(1, Math.ceil((result.count ?? 0) / safeSize))
    if (!result.error && lastPage > 1) {
      const last = bounds(lastPage)
      result = await queryRange(last.from, last.to)
    }
  }

  if (result.error) {
    throw result.error
  }

  const rows = result.data ?? []
  const total = result.count ?? rows.length
  const pageCount = Math.max(1, Math.ceil(total / safeSize))
  const page = Math.min(safeRequested, pageCount)

  return { rows, total, page, pageCount }
}
