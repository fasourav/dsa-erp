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
