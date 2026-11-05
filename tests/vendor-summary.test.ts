import assert from "node:assert/strict"
import fs from "node:fs"
import module from "node:module"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

type VendorRow = {
  id: string
  kind: "private" | "company"
  person_name: string | null
  company_name: string | null
  vendor_field: string | null
  email: string | null
  phone: string | null
  address: string | null
  notes: string | null
  updated_at: string
}

type CategoryRow = {
  name: string
  sort_order: number
}

type PurchaseOrderRecord = {
  id: string
  issued_on: string
  notes: string | null
  project_id: string | null
  vendor_id: string
  work_type: string | null
  total_value: number
  expense_category_id: string | null
  office_expense_category_id: string | null
}

type FakeDbState = {
  vendors: VendorRow[]
  categories: CategoryRow[]
  purchaseOrders: PurchaseOrderRecord[]
  projects: { id: string; name: string; total_value: number }[]
  expenseCategories: { id: string; name: string; sort_order: number }[]
  officeExpenseCategories: {
    id: string
    name: string
    sort_order: number
    report_group: string
  }[]
  isOwner: boolean
  canEditVendors: boolean
  canAddVendors: boolean
  hideVendorRows: boolean
  categorySelectError: boolean
  categoryInsertFailure: boolean
  vendorWriteFailure: boolean
  vendorDuplicateFailure: boolean
  onBeforeVendorWrite: ((state: FakeDbState) => void) | null
  rpcCallCount: number
  categorySelectCount: number
  categoryInsertCount: number
}

let dbState: FakeDbState = createInitialDbState()

function createInitialDbState(): FakeDbState {
  return {
    vendors: [],
    categories: [],
    purchaseOrders: [],
    projects: [],
    expenseCategories: [],
    officeExpenseCategories: [],
    isOwner: true,
    canEditVendors: true,
    canAddVendors: true,
    hideVendorRows: false,
    categorySelectError: false,
    categoryInsertFailure: false,
    vendorWriteFailure: false,
    vendorDuplicateFailure: false,
    onBeforeVendorWrite: null,
    rpcCallCount: 0,
    categorySelectCount: 0,
    categoryInsertCount: 0,
  }
}

function cloneStateSnapshot(state: FakeDbState) {
  return {
    vendors: state.vendors.map((v) => ({ ...v })),
    categories: state.categories.map((c) => ({ ...c })),
    categorySelectCount: state.categorySelectCount,
    categoryInsertCount: state.categoryInsertCount,
  }
}

function restoreStateSnapshot(
  state: FakeDbState,
  snapshot: ReturnType<typeof cloneStateSnapshot>,
) {
  state.vendors = snapshot.vendors
  state.categories = snapshot.categories
  state.categorySelectCount = snapshot.categorySelectCount
  state.categoryInsertCount = snapshot.categoryInsertCount
}

function createFakeSupabase(state: FakeDbState) {
  return {
    auth: {
      async getUser() {
        return { data: { user: { id: "user-1" } }, error: null }
      },
    },
    async rpc(
      fn: string,
      args: Record<string, unknown>,
    ): Promise<{
      data: unknown
      error: { code?: string; message: string } | null
    }> {
      if (fn !== "save_vendor") {
        return {
          data: null,
          error: { code: "42883", message: `Unknown RPC ${fn}` },
        }
      }

      state.rpcCallCount += 1
      // Simulate concurrent write arriving before the row lock is acquired.
      if (state.onBeforeVendorWrite) {
        const hook = state.onBeforeVendorWrite
        state.onBeforeVendorWrite = null
        hook(state)
      }

      const snapshot = cloneStateSnapshot(state)

      const failAndRollback = (code: string, message: string) => {
        restoreStateSnapshot(state, snapshot)
        return { data: null, error: { code, message } }
      }

      const pId = (args.p_id as string | null) ?? null
      const pVersion = (args.p_version as string | null) ?? null
      const pKind = String(args.p_kind ?? "").trim()
      const pPersonName =
        args.p_person_name === null || args.p_person_name === undefined
          ? null
          : String(args.p_person_name)
      const pCompanyName =
        args.p_company_name === null || args.p_company_name === undefined
          ? null
          : String(args.p_company_name)
      const vSubmittedField =
        String(args.p_vendor_field ?? "").trim() || null
      const pEmail =
        args.p_email === null || args.p_email === undefined
          ? null
          : String(args.p_email)
      const pPhone =
        args.p_phone === null || args.p_phone === undefined
          ? null
          : String(args.p_phone)
      const pAddress =
        args.p_address === null || args.p_address === undefined
          ? null
          : String(args.p_address)
      const pNotes =
        args.p_notes === null || args.p_notes === undefined
          ? null
          : String(args.p_notes)

      if (pKind !== "private" && pKind !== "company") {
        return failAndRollback("22023", "Choose Private or Company.")
      }

      let existing: VendorRow | undefined
      let vPrevTrimmed: string | null = null

      if (pId !== null) {
        if (!pVersion || Number.isNaN(Date.parse(pVersion))) {
          return failAndRollback(
            "22023",
            "Record version is required to update a vendor.",
          )
        }

        if (state.hideVendorRows) {
          return failAndRollback("P0002", "That vendor could not be found.")
        }

        existing = state.vendors.find((row) => row.id === pId)
        if (!existing) {
          return failAndRollback("P0002", "That vendor could not be found.")
        }

        if (!state.canEditVendors) {
          return failAndRollback(
            "42501",
            "You do not have permission to edit vendors.",
          )
        }

        if (Date.parse(existing.updated_at) !== Date.parse(pVersion)) {
          return failAndRollback(
            "40001",
            "This record was changed by someone else — reload.",
          )
        }

        vPrevTrimmed = existing.vendor_field?.trim() || null
      } else if (!state.canAddVendors) {
        return failAndRollback(
          "42501",
          "You do not have permission to add vendors.",
        )
      }

      let vFinalField: string | null = null
      if (vSubmittedField !== null) {
        if (
          pId !== null &&
          vPrevTrimmed !== null &&
          vSubmittedField.toLowerCase() === vPrevTrimmed.toLowerCase()
        ) {
          vFinalField = vPrevTrimmed
        } else {
          vFinalField = vSubmittedField
          state.categorySelectCount += 1
          const categoryExists = state.categories.some(
            (cat) =>
              cat.name.trim().toLowerCase() === vSubmittedField.toLowerCase(),
          )

          if (!categoryExists) {
            if (!state.isOwner) {
              return failAndRollback(
                "42501",
                "Only owners can add new vendor categories.",
              )
            }
            if (state.categoryInsertFailure) {
              return failAndRollback(
                "55000",
                'relation "vendor_work_categories" write failed',
              )
            }
            const maxSort = state.categories.reduce(
              (max, c) => Math.max(max, c.sort_order),
              0,
            )
            state.categoryInsertCount += 1
            state.categories.push({
              name: vSubmittedField,
              sort_order: (Math.trunc(maxSort / 10) + 1) * 10,
            })
          }
        }
      }

      if (state.vendorDuplicateFailure) {
        return failAndRollback(
          "23505",
          "duplicate key value violates unique constraint",
        )
      }

      if (state.vendorWriteFailure) {
        return failAndRollback("55000", 'relation "vendors" write failed')
      }

      if (pId === null) {
        const nextVersion = "2026-04-20T12:00:00.000Z"
        const created: VendorRow = {
          id: `00000000-0000-0000-0000-${String(state.vendors.length + 1).padStart(12, "0")}`,
          kind: pKind,
          person_name: pPersonName,
          company_name: pCompanyName,
          vendor_field: vFinalField,
          email: pEmail,
          phone: pPhone,
          address: pAddress,
          notes: pNotes,
          updated_at: nextVersion,
        }
        state.vendors.push(created)
        return {
          data: { id: created.id, version: created.updated_at },
          error: null,
        }
      }

      const nextVersion = "2026-04-20T12:05:00.000Z"
      Object.assign(existing!, {
        kind: pKind,
        person_name: pPersonName,
        company_name: pCompanyName,
        vendor_field: vFinalField,
        email: pEmail,
        phone: pPhone,
        address: pAddress,
        notes: pNotes,
        updated_at: nextVersion,
      })
      return {
        data: { id: existing!.id, version: existing!.updated_at },
        error: null,
      }
    },
    from(table: string) {
      let action: "select" | "insert" | "update" = "select"
      let payload: Record<string, unknown> | null = null
      const eqFilters = new Map<string, unknown>()
      const neqFilters = new Map<string, unknown>()
      let ilikeFilter: { column: string; pattern: string } | null = null

      function execute(): {
        data: unknown[] | null
        error: { message: string } | null
      } {
        if (table === "vendors") {
          let rows = [...state.vendors]
          for (const [col, val] of eqFilters.entries()) {
            rows = rows.filter(
              (row) => (row as Record<string, unknown>)[col] === val,
            )
          }
          for (const [col, val] of neqFilters.entries()) {
            rows = rows.filter(
              (row) => (row as Record<string, unknown>)[col] !== val,
            )
          }
          if (ilikeFilter) {
            const needle = ilikeFilter.pattern.toLowerCase()
            const col = ilikeFilter.column
            rows = rows.filter((row) => {
              const val = String((row as Record<string, unknown>)[col] ?? "")
              return val.toLowerCase() === needle
            })
          }
          return { data: rows, error: null }
        }

        if (table === "vendor_summaries") {
          return {
            data: state.vendors.map((v) => ({
              vendor_id: v.id,
              kind: v.kind,
              display_name: v.kind === "company" ? v.company_name : v.person_name,
              vendor_field: v.vendor_field,
              total_po_value: 0,
              total_paid: 0,
              total_due: 0,
            })),
            error: null,
          }
        }

        if (table === "vendor_work_categories") {
          if (state.categorySelectError && action === "select") {
            return {
              data: null,
              error: { message: "permission denied or connection lost" },
            }
          }

          state.categorySelectCount += 1
          const sorted = [...state.categories].sort((a, b) => {
            if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
            return a.name.localeCompare(b.name)
          })
          return { data: sorted, error: null }
        }

        if (table === "vendor_purchase_orders") {
          if (action === "update" && payload) {
            const targetId = eqFilters.get("id")
            const target = state.purchaseOrders.find(
              (row) => row.id === targetId,
            )
            if (!target) {
              return { data: [], error: null }
            }
            Object.assign(target, {
              project_id: payload.project_id as string | null,
              vendor_id: payload.vendor_id as string,
              issued_on: payload.issued_on as string,
              work_type: payload.work_type as string | null,
              expense_category_id: payload.expense_category_id as string | null,
              office_expense_category_id:
                payload.office_expense_category_id as string | null,
              total_value: Number(payload.total_value),
              notes: payload.notes as string | null,
            })
            return { data: [{ id: target.id }], error: null }
          }
          return { data: [...state.purchaseOrders], error: null }
        }

        if (table === "projects") {
          let rows = [...state.projects]
          if (eqFilters.has("id")) {
            rows = rows.filter((r) => r.id === eqFilters.get("id"))
          }
          return { data: rows, error: null }
        }

        if (table === "project_expense_categories") {
          let rows = [...state.expenseCategories]
          if (eqFilters.has("id")) {
            rows = rows.filter((r) => r.id === eqFilters.get("id"))
          }
          return { data: rows, error: null }
        }

        if (table === "office_expense_categories") {
          let rows = [...state.officeExpenseCategories]
          if (eqFilters.has("id")) {
            rows = rows.filter((r) => r.id === eqFilters.get("id"))
          }
          return { data: rows, error: null }
        }

        if (
          table === "vendor_po_balances" ||
          table === "vendor_invoices" ||
          table === "vendor_payments"
        ) {
          return { data: [], error: null }
        }

        return { data: [], error: null }
      }

      const builder = {
        select() {
          return builder
        },
        insert(values: Record<string, unknown>) {
          action = "insert"
          payload = values
          return builder
        },
        update(values: Record<string, unknown>) {
          action = "update"
          payload = values
          return builder
        },
        eq(col: string, val: unknown) {
          eqFilters.set(col, val)
          return builder
        },
        neq(col: string, val: unknown) {
          neqFilters.set(col, val)
          return builder
        },
        ilike(col: string, pattern: string) {
          ilikeFilter = { column: col, pattern }
          return builder
        },
        order() {
          return builder
        },
        limit() {
          return builder
        },
        range() {
          return builder
        },
        then<TResult1 = unknown, TResult2 = never>(
          onfulfilled?:
            | ((value: {
                data: unknown[] | null
                error: { message: string } | null
              }) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null,
        ) {
          return Promise.resolve(execute()).then(onfulfilled, onrejected)
        },
      }

      return builder
    },
  }
}

const VIRTUAL_MODULES: Record<string, string> = {
  "virtual:next-cache": `export function revalidatePath() {}`,
  "virtual:permissions": `export async function denyUnless() { return null }`,
  "virtual:revalidate-settings": `export function revalidateSettings() {}`,
  "virtual:attachment-files": `export function cleanUpDeletedAttachmentFiles() {}`,
  "virtual:supabase-server": `
    export async function createClient() {
      return globalThis.__testSupabaseClient()
    }
  `,
}

;(globalThis as Record<string, unknown>).__testSupabaseClient = () =>
  createFakeSupabase(dbState)

module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/cache") {
      return { url: "virtual:next-cache", shortCircuit: true }
    }
    if (specifier === "@/lib/permissions") {
      return { url: "virtual:permissions", shortCircuit: true }
    }
    if (specifier === "@/lib/revalidate-settings") {
      return { url: "virtual:revalidate-settings", shortCircuit: true }
    }
    if (specifier === "@/lib/attachment-files") {
      return { url: "virtual:attachment-files", shortCircuit: true }
    }
    if (specifier === "@/lib/supabase/server") {
      return { url: "virtual:supabase-server", shortCircuit: true }
    }
    if (specifier.startsWith("@/")) {
      const target = path.resolve(
        process.cwd(),
        "src",
        `${specifier.slice(2)}.ts`,
      )
      return nextResolve(pathToFileURL(target).href, context)
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url in VIRTUAL_MODULES) {
      return {
        format: "module",
        source: VIRTUAL_MODULES[url],
        shortCircuit: true,
      }
    }
    return nextLoad(url, context)
  },
})

const {
  catalogCategoryOptions,
  dataColumns,
  MISSING_VENDOR_VERSION_MESSAGE,
  ONLY_OWNERS_CATEGORY_MESSAGE,
  sortVendors,
} = await import("../src/lib/vendor-summary.ts")
import type { VendorSummary } from "../src/lib/vendor-summary.ts"
const { STALE_RECORD_MESSAGE } = await import("../src/lib/record-version.ts")
const { addVendor, loadVendorCategoryOptions, updateVendor } = await import(
  "../src/app/(app)/vendors/actions.ts"
)
const { getVendors } = await import("../src/lib/vendors.ts")
const { getPurchaseOrders } = await import("../src/lib/purchase-orders.ts")
const { updatePurchaseOrder } = await import(
  "../src/app/(app)/purchase-orders/actions.ts"
)

const VENDOR_ID = "00000000-0000-4000-8000-000000000001"
const PROJECT_ID = "00000000-0000-4000-8000-000000000010"
const EXPENSE_CAT_ID = "00000000-0000-4000-8000-000000000020"
const PO_ID = "00000000-0000-4000-8000-000000000030"
const INITIAL_VERSION = "2026-04-20T10:00:00.000Z"

function sampleVendor(overrides: Partial<VendorSummary>): VendorSummary {
  return {
    id: VENDOR_ID,
    displayName: "Vendor",
    kind: "company",
    vendorField: null,
    personName: null,
    companyName: "Vendor",
    email: null,
    phone: null,
    notes: null,
    address: null,
    totalProjectValue: 0,
    totalPaid: 0,
    totalDue: 0,
    ...overrides,
  }
}

test("dataColumns places Category between Vendor Name and Contact", () => {
  assert.deepEqual(
    dataColumns.map((column) => [column.id, column.label]),
    [
      ["displayName", "Vendor Name"],
      ["vendorField", "Category"],
      ["contact", "Contact"],
      ["totalProjectValue", "Total Project Value"],
      ["totalPaid", "Total Paid"],
      ["totalDue", "Total Due"],
    ],
  )
})

test("sortVendors sorts by category name case-insensitively", () => {
  const rows = [
    sampleVendor({ id: "1", displayName: "B", vendorField: "Plumbing" }),
    sampleVendor({ id: "2", displayName: "A", vendorField: "electrical" }),
    sampleVendor({ id: "3", displayName: "C", vendorField: null }),
  ]

  const asc = sortVendors(rows, { key: "vendorField", direction: "asc" })
  assert.deepEqual(
    asc.map((row) => row.id),
    ["3", "2", "1"],
  )

  const desc = sortVendors(rows, { key: "vendorField", direction: "desc" })
  assert.deepEqual(
    desc.map((row) => row.id),
    ["1", "2", "3"],
  )
})

test("catalogCategoryOptions preserves live catalog order and drops blanks/duplicates", () => {
  assert.deepEqual(
    catalogCategoryOptions([" Electrical ", "Civil", "", "electrical", "HVAC"]),
    ["Electrical", "Civil", "HVAC"],
  )
})

test("1 & 2. unchanged deleted historical category (exact and case-insensitive): vendor edit succeeds and no catalog row is recreated", async () => {
  dbState = createInitialDbState()
  dbState.categories = [{ name: "Electrical", sort_order: 10 }]
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Deleted Masonry",
      email: "info@apex.test",
      phone: "+8801711000001",
      address: "Old Road 1",
      notes: "Initial note",
      updated_at: INITIAL_VERSION,
    },
  ]

  // Exact match on deleted historical category
  const exactResult = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "Deleted Masonry",
    email: "info@apex.test",
    phone: "+8801711000088",
    address: "New Avenue 10",
    notes: "Initial note",
    version: INITIAL_VERSION,
  })

  assert.equal(exactResult.error, null)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.equal(dbState.categorySelectCount, 0)
  assert.equal(dbState.vendors[0].phone, "+8801711000088")
  assert.equal(dbState.vendors[0].vendor_field, "Deleted Masonry")

  // Case-insensitive + whitespace match on deleted historical category
  const nextVersion = dbState.vendors[0].updated_at
  const caseInsensitiveResult = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "  deleted masonry ",
    email: "info@apex.test",
    phone: "+8801711000099",
    address: "New Avenue 42",
    notes: "Updated note",
    version: nextVersion,
  })

  assert.equal(caseInsensitiveResult.error, null)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.equal(dbState.categorySelectCount, 0)
  assert.deepEqual(
    dbState.categories.map((c) => c.name),
    ["Electrical"],
  )
  assert.equal(dbState.vendors[0].phone, "+8801711000099")
  assert.equal(dbState.vendors[0].address, "New Avenue 42")
  assert.equal(dbState.vendors[0].vendor_field, "Deleted Masonry")
})

test("3. stale version: returns conflict error with no vendor mutation and no catalog insertion", async () => {
  dbState = createInitialDbState()
  dbState.categories = [{ name: "Electrical", sort_order: 10 }]
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Electrical",
      email: "info@apex.test",
      phone: "+8801711000001",
      address: "Old Road 1",
      notes: "Initial note",
      updated_at: "2026-04-20T11:00:00.000Z",
    },
  ]

  const result = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "Brand New Category",
    email: "info@apex.test",
    phone: "+8801711000099",
    address: "Changed Road",
    notes: "Changed note",
    version: "2026-04-20T09:00:00.000Z",
  })

  assert.equal(result.error, STALE_RECORD_MESSAGE)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.deepEqual(
    dbState.categories.map((c) => c.name),
    ["Electrical"],
  )
  assert.equal(dbState.vendors[0].phone, "+8801711000001")
  assert.equal(dbState.vendors[0].vendor_field, "Electrical")
})

test("4. missing version on edit: rejected safely before any RPC or database writes", async () => {
  dbState = createInitialDbState()
  dbState.categories = [{ name: "Electrical", sort_order: 10 }]
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Electrical",
      email: null,
      phone: "+8801711000001",
      address: "Road 1",
      notes: null,
      updated_at: INITIAL_VERSION,
    },
  ]

  const missingVersionResult = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "New Unsaved Category",
    email: "",
    phone: "+8801711000099",
    address: "Road 2",
    notes: "",
  })

  assert.equal(missingVersionResult.error, MISSING_VENDOR_VERSION_MESSAGE)
  assert.equal(dbState.rpcCallCount, 0)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.equal(dbState.vendors[0].phone, "+8801711000001")

  const invalidVersionResult = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "New Unsaved Category",
    email: "",
    phone: "+8801711000099",
    address: "Road 2",
    notes: "",
    version: "not-a-timestamp",
  })

  assert.equal(invalidVersionResult.error, MISSING_VENDOR_VERSION_MESSAGE)
  assert.equal(dbState.rpcCallCount, 0)
  assert.equal(dbState.categoryInsertCount, 0)
})

test("5. conflict arising after the initial read: atomic check prevents partial catalog or vendor writes", async () => {
  dbState = createInitialDbState()
  dbState.categories = [{ name: "Electrical", sort_order: 10 }]
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Deleted Masonry",
      email: null,
      phone: "+8801711000001",
      address: "Road 1",
      notes: null,
      updated_at: INITIAL_VERSION,
    },
  ]

  // Simulate another user updating the vendor after the dialog read INITIAL_VERSION
  // but before save_vendor acquires its row lock.
  dbState.onBeforeVendorWrite = (state) => {
    state.vendors[0].phone = "+8801711000077"
    state.vendors[0].updated_at = "2026-04-20T10:30:00.000Z"
  }

  const result = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "New Concurrent Category",
    email: "",
    phone: "+8801711000099",
    address: "Road 2",
    notes: "",
    version: INITIAL_VERSION,
  })

  assert.equal(result.error, STALE_RECORD_MESSAGE)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.deepEqual(
    dbState.categories.map((c) => c.name),
    ["Electrical"],
  )
  assert.equal(dbState.vendors[0].phone, "+8801711000077")
  assert.equal(dbState.vendors[0].vendor_field, "Deleted Masonry")
})

test("6. vendor-write failure rolls back new category insertion so no catalog entry remains", async () => {
  dbState = createInitialDbState()
  dbState.categories = [{ name: "Electrical", sort_order: 10 }]
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Electrical",
      email: null,
      phone: "+8801711000001",
      address: "Road 1",
      notes: null,
      updated_at: INITIAL_VERSION,
    },
  ]
  dbState.vendorWriteFailure = true

  const updateRes = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "Rolled Back Category",
    email: "",
    phone: "+8801711000099",
    address: "Road 2",
    notes: "",
    version: INITIAL_VERSION,
  })

  assert.equal(updateRes.error, "Could not save this vendor.")
  assert.equal(dbState.categoryInsertCount, 0)
  assert.deepEqual(
    dbState.categories.map((c) => c.name),
    ["Electrical"],
  )
  assert.equal(dbState.vendors[0].vendor_field, "Electrical")

  // Concurrent unique constraint violation inside RPC also rolls back category insertion
  dbState.vendorWriteFailure = false
  dbState.vendorDuplicateFailure = true

  const addRes = await addVendor({
    kind: "company",
    name: "Other Unique Co",
    vendorField: "Duplicate Vendor Category",
    email: "",
    phone: "+8801711000050",
    address: "",
    notes: "",
  })

  assert.equal(
    addRes.fieldErrors?.name,
    "A vendor with this name already exists.",
  )
  assert.equal(dbState.categoryInsertCount, 0)
  assert.deepEqual(
    dbState.categories.map((c) => c.name),
    ["Electrical"],
  )
})

test("7. category-write failure leaves no vendor insert or update", async () => {
  dbState = createInitialDbState()
  dbState.categories = [{ name: "Electrical", sort_order: 10 }]
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Electrical",
      email: null,
      phone: "+8801711000001",
      address: "Road 1",
      notes: null,
      updated_at: INITIAL_VERSION,
    },
  ]
  dbState.categoryInsertFailure = true

  const addRes = await addVendor({
    kind: "private",
    name: "New Person Vendor",
    vendorField: "Failing Category",
    email: "",
    phone: "+8801711000055",
    address: "Dhaka",
    notes: "",
  })

  assert.equal(addRes.error, "Could not save this vendor.")
  assert.equal(dbState.vendors.length, 1)
  assert.deepEqual(
    dbState.categories.map((c) => c.name),
    ["Electrical"],
  )

  const editRes = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders Renamed",
    vendorField: "Failing Category",
    email: "",
    phone: "+8801711000099",
    address: "Road 99",
    notes: "",
    version: INITIAL_VERSION,
  })

  assert.equal(editRes.error, "Could not save this vendor.")
  assert.equal(dbState.vendors[0].company_name, "Apex Builders")
  assert.equal(dbState.vendors[0].phone, "+8801711000001")
  assert.equal(dbState.vendors[0].vendor_field, "Electrical")
})

test("8. authorized new category: both catalog and vendor writes succeed together", async () => {
  dbState = createInitialDbState()
  dbState.isOwner = true
  dbState.categories = [{ name: "Electrical", sort_order: 10 }]
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Deleted Masonry",
      email: null,
      phone: "+8801711000001",
      address: "Road 1",
      notes: null,
      updated_at: INITIAL_VERSION,
    },
  ]

  const addResult = await addVendor({
    kind: "private",
    name: "Rahim Mia",
    vendorField: "Solar Work",
    email: "",
    phone: "+8801711000055",
    address: "Dhaka",
    notes: "",
  })

  assert.equal(addResult.error, null)
  assert.equal(dbState.categoryInsertCount, 1)
  assert.deepEqual(
    dbState.categories.map((c) => c.name),
    ["Electrical", "Solar Work"],
  )

  const updateResult = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "Acoustic Ceiling",
    email: "",
    phone: "+8801711000001",
    address: "Road 1",
    notes: "",
    version: INITIAL_VERSION,
  })

  assert.equal(updateResult.error, null)
  assert.equal(dbState.categoryInsertCount, 2)
  assert.deepEqual(
    dbState.categories.map((c) => c.name),
    ["Electrical", "Solar Work", "Acoustic Ceiling"],
  )
  assert.equal(dbState.vendors[0].vendor_field, "Acoustic Ceiling")
})

test("9. non-owner using an existing category or preserving unchanged historical category succeeds", async () => {
  dbState = createInitialDbState()
  dbState.isOwner = false
  dbState.categories = [
    { name: "Electrical", sort_order: 10 },
    { name: "Plumbing", sort_order: 20 },
  ]
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Deleted Masonry",
      email: null,
      phone: "+8801711000001",
      address: "Road 1",
      notes: null,
      updated_at: INITIAL_VERSION,
    },
  ]

  // Non-owner preserving deleted historical category while editing phone
  const preserveResult = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "Deleted Masonry",
    email: "",
    phone: "+8801711000022",
    address: "Road 2",
    notes: "",
    version: INITIAL_VERSION,
  })

  assert.equal(preserveResult.error, null)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.equal(dbState.vendors[0].phone, "+8801711000022")
  assert.equal(dbState.vendors[0].vendor_field, "Deleted Masonry")

  // Non-owner switching vendor to an existing catalog category
  const switchExistingResult = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "Plumbing",
    email: "",
    phone: "+8801711000033",
    address: "Road 3",
    notes: "",
    version: dbState.vendors[0].updated_at,
  })

  assert.equal(switchExistingResult.error, null)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.equal(dbState.vendors[0].vendor_field, "Plumbing")

  // Non-owner adding a vendor with an existing catalog category
  const addExistingResult = await addVendor({
    kind: "private",
    name: "Karim Uddin",
    vendorField: "Electrical",
    email: "",
    phone: "+8801711000044",
    address: "Chittagong",
    notes: "",
  })

  assert.equal(addExistingResult.error, null)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.equal(dbState.vendors.length, 2)
})

test("10. non-owner attempting a new category gets a specific field error and leaves no writes", async () => {
  dbState = createInitialDbState()
  dbState.isOwner = false
  dbState.categories = [{ name: "Electrical", sort_order: 10 }]
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Electrical",
      email: null,
      phone: "+8801711000001",
      address: "Road 1",
      notes: null,
      updated_at: INITIAL_VERSION,
    },
  ]

  const editNewCat = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders Updated",
    vendorField: "Unauthorized Landscaping",
    email: "",
    phone: "+8801711000099",
    address: "Road 99",
    notes: "",
    version: INITIAL_VERSION,
  })

  assert.equal(editNewCat.fieldErrors?.vendorField, ONLY_OWNERS_CATEGORY_MESSAGE)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.deepEqual(
    dbState.categories.map((c) => c.name),
    ["Electrical"],
  )
  // Other vendor edits must NOT be partially saved
  assert.equal(dbState.vendors[0].company_name, "Apex Builders")
  assert.equal(dbState.vendors[0].phone, "+8801711000001")
  assert.equal(dbState.vendors[0].address, "Road 1")

  const addNewCat = await addVendor({
    kind: "private",
    name: "New Vendor",
    vendorField: "Unauthorized Landscaping",
    email: "",
    phone: "+8801711000088",
    address: "Sylhet",
    notes: "",
  })

  assert.equal(addNewCat.fieldErrors?.vendorField, ONLY_OWNERS_CATEGORY_MESSAGE)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.equal(dbState.vendors.length, 1)
})

test("11. catalog-load failure is surfaced in getVendors and loadVendorCategoryOptions without falling back to historical vendor values", async () => {
  dbState = createInitialDbState()
  dbState.categorySelectError = true
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Historical Category",
      email: null,
      phone: "+8801711000001",
      address: "Road 1",
      notes: null,
      updated_at: INITIAL_VERSION,
    },
  ]

  const pageData = await getVendors()
  assert.equal(pageData.error, "Could not load vendor categories.")
  assert.deepEqual(pageData.categories, [])
  assert.deepEqual(pageData.vendors, [])

  const dialogOptions = await loadVendorCategoryOptions()
  assert.equal(dialogOptions.categories, null)
  assert.equal(dialogOptions.error, "Could not load vendor categories.")
})

test("12. PO suggestions remain catalog-only and historical PO work types remain visible and editable", async () => {
  dbState = createInitialDbState()
  dbState.categories = [
    { name: "Civil", sort_order: 20 },
    { name: "Electrical", sort_order: 10 },
    { name: "civil", sort_order: 30 },
  ]
  dbState.projects = [
    { id: PROJECT_ID, name: "Tower A", total_value: 500_000 },
  ]
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Deleted Masonry",
      email: null,
      phone: "+8801711000001",
      address: "Old Road",
      notes: "Vendor note",
      updated_at: INITIAL_VERSION,
    },
  ]
  dbState.expenseCategories = [
    { id: EXPENSE_CAT_ID, name: "Subcontractor", sort_order: 10 },
  ]
  dbState.purchaseOrders = [
    {
      id: PO_ID,
      issued_on: "2026-03-10",
      notes: "Original PO note",
      project_id: PROJECT_ID,
      vendor_id: VENDOR_ID,
      work_type: "Legacy Woodwork",
      total_value: 50_000,
      expense_category_id: EXPENSE_CAT_ID,
      office_expense_category_id: null,
    },
  ]

  const poData = await getPurchaseOrders(null)
  assert.equal(poData.error, null)
  assert.deepEqual(poData.workTypes, ["Electrical", "Civil"])
  assert.equal(poData.workTypes.includes("Legacy Woodwork"), false)
  assert.equal(poData.orders[0]?.workType, "Legacy Woodwork")

  const poEdit = await updatePurchaseOrder(PO_ID, {
    projectId: PROJECT_ID,
    vendorId: VENDOR_ID,
    issuedOn: "2026-03-10",
    workType: poData.orders[0].workType,
    expenseCategoryId: EXPENSE_CAT_ID,
    officeExpenseCategoryId: "",
    totalValue: "65000",
    notes: "Updated PO note without changing workType",
  })

  assert.equal(poEdit.error, null)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.deepEqual(
    dbState.categories.map((c) => c.name),
    ["Civil", "Electrical", "civil"],
  )

  const poLoadAfter = await getPurchaseOrders(null)
  assert.equal(poLoadAfter.orders[0]?.workType, "Legacy Woodwork")
  assert.equal(poLoadAfter.orders[0]?.totalValue, 65_000)
  assert.deepEqual(poLoadAfter.workTypes, ["Electrical", "Civil"])
})

test("atomic save_vendor SQL migration enforces row locking, version check, owner-only category insert, and security invoker", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261106024500_atomic_save_vendor.sql",
  )
  const sql = fs.readFileSync(migrationPath, "utf8")

  assert.match(sql, /create or replace function public\.save_vendor\(/i)
  assert.match(sql, /security invoker/i)
  assert.match(sql, /for update/i)
  assert.match(sql, /errcode = '40001'/i)
  assert.match(sql, /not private\.is_owner\(\)/i)
  assert.match(sql, /errcode = '42501'/i)
  assert.match(sql, /lower\(v_submitted_field\) = lower\(v_prev_trimmed\)/i)
  assert.match(sql, /grant execute on function public\.save_vendor/i)
})

test("RLS edit denial from save_vendor is not reported as a stale write", async () => {
  dbState = createInitialDbState()
  dbState.canEditVendors = false
  dbState.categories = [{ name: "Electrical", sort_order: 10 }]
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Deleted Masonry",
      email: null,
      phone: "+8801711000001",
      address: "Road 1",
      notes: null,
      updated_at: INITIAL_VERSION,
    },
  ]

  const result = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "deleted masonry",
    email: "",
    phone: "+8801711000099",
    address: "Road 2",
    notes: "",
    version: INITIAL_VERSION,
  })

  assert.equal(result.error, "You do not have permission to edit vendors.")
  assert.equal(result.fieldErrors, undefined)
  assert.equal(dbState.categoryInsertCount, 0)
  assert.equal(dbState.vendors[0].phone, "+8801711000001")
  assert.equal(dbState.vendors[0].vendor_field, "Deleted Masonry")
})

test("a vendor hidden by SELECT RLS stays not-found and is not a permission error", async () => {
  dbState = createInitialDbState()
  dbState.hideVendorRows = true
  dbState.canEditVendors = false
  dbState.vendors = [
    {
      id: VENDOR_ID,
      kind: "company",
      person_name: null,
      company_name: "Apex Builders",
      vendor_field: "Electrical",
      email: null,
      phone: "+8801711000001",
      address: "Road 1",
      notes: null,
      updated_at: INITIAL_VERSION,
    },
  ]

  const result = await updateVendor(VENDOR_ID, {
    kind: "company",
    name: "Apex Builders",
    vendorField: "Electrical",
    email: "",
    phone: "+8801711000001",
    address: "Road 1",
    notes: "",
    version: INITIAL_VERSION,
  })

  assert.equal(result.error, "That vendor could not be found.")
  assert.equal(dbState.vendors[0].company_name, "Apex Builders")
})

test("RLS add denial from save_vendor is a permission error and writes nothing", async () => {
  dbState = createInitialDbState()
  dbState.canAddVendors = false
  dbState.isOwner = false

  const result = await addVendor({
    kind: "company",
    name: "Blocked Vendor",
    vendorField: "Electrical",
    email: "",
    phone: "+8801711000088",
    address: "Road 8",
    notes: "",
  })

  assert.equal(result.error, "You do not have permission to add vendors.")
  assert.equal(dbState.vendors.length, 0)
  assert.equal(dbState.categoryInsertCount, 0)
})
