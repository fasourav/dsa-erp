export const PAGE_SIZE = 10

export type VendorKind = "private" | "company"

export function isVendorKind(value: string): value is VendorKind {
  return value === "private" || value === "company"
}

export type VendorSummary = {
  id: string
  displayName: string
  kind: VendorKind | null
  vendorField: string | null
  personName: string | null
  companyName: string | null
  email: string | null
  phone: string | null
  notes: string | null
  totalProjectValue: number
  totalPaid: number
  totalDue: number
}

export type ColumnId =
  | "displayName"
  | "contact"
  | "totalProjectValue"
  | "totalPaid"
  | "totalDue"

export type SortDirection = "asc" | "desc"

export type SortState = {
  key: ColumnId
  direction: SortDirection
}

export type DataColumn = {
  id: ColumnId
  label: string
  align: "left" | "right"
}

export const dataColumns: readonly DataColumn[] = [
  { id: "displayName", label: "Vendor Name", align: "left" },
  { id: "contact", label: "Contact", align: "left" },
  { id: "totalProjectValue", label: "Total Project Value", align: "right" },
  { id: "totalPaid", label: "Total Paid", align: "right" },
  { id: "totalDue", label: "Total Due", align: "right" },
]

export function sortVendors(
  vendors: readonly VendorSummary[],
  sort: SortState,
): VendorSummary[] {
  const direction = sort.direction === "asc" ? 1 : -1

  return [...vendors].sort((a, b) => {
    const primary = compareVendors(a, b, sort.key) * direction
    if (primary !== 0) {
      return primary
    }

    const byName = a.displayName.localeCompare(b.displayName, "en", {
      sensitivity: "base",
    })
    if (byName !== 0) {
      return byName
    }

    return a.id.localeCompare(b.id)
  })
}

function compareVendors(
  a: VendorSummary,
  b: VendorSummary,
  key: ColumnId,
): number {
  switch (key) {
    case "displayName":
      return a.displayName.localeCompare(b.displayName, "en", {
        sensitivity: "base",
      })
    case "contact":
      return contactSortKey(a).localeCompare(contactSortKey(b), "en", {
        sensitivity: "base",
        numeric: true,
      })
    case "totalProjectValue":
    case "totalPaid":
    case "totalDue":
      return a[key] - b[key]
  }
}

function contactSortKey(vendor: VendorSummary): string {
  const phone = vendor.phone?.trim() ?? ""
  const email = vendor.email?.trim() ?? ""
  return `${phone}\n${email}`
}

export function paginateVendors(
  vendors: readonly VendorSummary[],
  page: number,
) {
  const total = vendors.length
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, page), pageCount)
  const startIndex = (currentPage - 1) * PAGE_SIZE

  return {
    rows: vendors.slice(startIndex, startIndex + PAGE_SIZE),
    total,
    pageCount,
    currentPage,
    rangeStart: total === 0 ? 0 : startIndex + 1,
    rangeEnd: Math.min(startIndex + PAGE_SIZE, total),
  }
}

export function paginationItems(
  currentPage: number,
  pageCount: number,
): Array<number | "ellipsis"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1)
  }

  const pages = [1, pageCount, currentPage - 1, currentPage, currentPage + 1]
    .filter(
      (page, index, all) =>
        page >= 1 && page <= pageCount && all.indexOf(page) === index,
    )
    .sort((left, right) => left - right)

  const items: Array<number | "ellipsis"> = []

  for (const page of pages) {
    const previous = items.at(-1)
    if (typeof previous === "number" && page - previous > 1) {
      items.push("ellipsis")
    }
    items.push(page)
  }

  return items
}

export function vendorRangeLabel(
  start: number,
  end: number,
  total: number,
): string {
  if (total === 0) {
    return "0 vendors"
  }

  const noun = total === 1 ? "vendor" : "vendors"

  if (start === end) {
    return `Showing ${start} of ${total} ${noun}`
  }

  return `Showing ${start}–${end} of ${total} ${noun}`
}

export function mergeCategorySuggestions(
  catalogNames: readonly string[],
  existingFields: readonly (string | null | undefined)[],
): string[] {
  const seen = new Set<string>()
  const suggestions: string[] = []

  for (const value of catalogNames) {
    pushSuggestion(suggestions, seen, value)
  }

  const extras = existingFields
    .flatMap((value) => {
      const name = value?.trim() ?? ""
      return name ? [name] : []
    })
    .sort((left, right) =>
      left.localeCompare(right, "en", { sensitivity: "base" }),
    )

  for (const value of extras) {
    pushSuggestion(suggestions, seen, value)
  }

  return suggestions
}

function pushSuggestion(suggestions: string[], seen: Set<string>, value: string) {
  const name = value.trim()
  const key = name.toLowerCase()

  if (!name || seen.has(key)) {
    return
  }

  seen.add(key)
  suggestions.push(name)
}
