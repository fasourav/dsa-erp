export const catalogDefinitions = [
  {
    key: "departments",
    label: "Departments",
    singular: "department",
    hasActive: true,
    hasCode: false,
    hasIsOpen: false,
  },
  {
    key: "project_types",
    label: "Project Types",
    singular: "project type",
    hasActive: false,
    hasCode: false,
    hasIsOpen: false,
  },
  {
    key: "project_phases",
    label: "Project Phases",
    singular: "project phase",
    hasActive: false,
    hasCode: false,
    hasIsOpen: false,
  },
  {
    key: "office_expense_categories",
    label: "Office Expense Categories",
    singular: "office expense category",
    hasActive: false,
    hasCode: false,
    hasIsOpen: false,
  },
  {
    key: "project_expense_categories",
    label: "Project Expense Categories",
    singular: "project expense category",
    hasActive: false,
    hasCode: false,
    hasIsOpen: false,
  },
  {
    key: "payment_methods",
    label: "Payment Methods",
    singular: "payment method",
    hasActive: false,
    hasCode: false,
    hasIsOpen: false,
  },
  {
    key: "vendor_work_categories",
    label: "Vendor Work Categories",
    singular: "vendor work category",
    hasActive: false,
    hasCode: false,
    hasIsOpen: false,
  },
  {
    key: "lead_sources",
    label: "Lead Sources",
    singular: "lead source",
    hasActive: false,
    hasCode: false,
    hasIsOpen: false,
  },
  {
    key: "lead_stages",
    label: "Lead Stages",
    singular: "lead stage",
    hasActive: false,
    hasCode: false,
    hasIsOpen: false,
  },
  {
    key: "lead_statuses",
    label: "Lead Statuses",
    singular: "lead status",
    hasActive: false,
    hasCode: true,
    // is_open remains in DB with silent defaults; not exposed in Settings UI
    hasIsOpen: false,
  },
] as const

export type CatalogDefinition = (typeof catalogDefinitions)[number]
export type CatalogKey = CatalogDefinition["key"]

export type CatalogItem = {
  id: string
  name: string
  sortOrder: number
  isActive: boolean | null
  code: string | null
  isOpen: boolean | null
}

export type CatalogList = CatalogDefinition & {
  items: CatalogItem[]
}

const INT4_MIN = -2_147_483_648
const INT4_MAX = 2_147_483_647

const catalogKeySet = new Set<string>(
  catalogDefinitions.map((catalog) => catalog.key),
)

export function isCatalogKey(value: string): value is CatalogKey {
  return catalogKeySet.has(value)
}

export function catalogSingularTitle(singular: string) {
  return singular.replace(/(^|\s)([a-z])/g, (_match, space: string, letter: string) => {
    return `${space}${letter.toUpperCase()}`
  })
}

export function catalogByKey(key: CatalogKey): CatalogDefinition {
  const definition = catalogDefinitions.find((catalog) => catalog.key === key)

  if (!definition) {
    throw new Error("Unknown lookup catalog.")
  }

  return definition
}

export function duplicateNameMessage(singular: string) {
  const article = /^[aeiou]/i.test(singular) ? "An" : "A"
  return `${article} ${singular} with this name already exists.`
}

export function parseSortOrder(value: string): number | null {
  const trimmed = value.trim()

  if (!/^-?\d+$/.test(trimmed)) {
    return null
  }

  const parsed = Number(trimmed)

  if (!isSortOrder(parsed)) {
    return null
  }

  return parsed
}

export function isSortOrder(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= INT4_MIN &&
    value <= INT4_MAX
  )
}

export function nextSortOrder(items: { sortOrder: number }[]) {
  if (items.length === 0) {
    return 1
  }

  const max = Math.max(...items.map((item) => item.sortOrder))
  return max >= INT4_MAX ? max : max + 1
}

export function slugifyCatalogCode(name: string) {
  let slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")

  if (!slug) {
    return "item"
  }

  if (!/^[a-z]/.test(slug)) {
    slug = `s_${slug}`
  }

  return slug
}