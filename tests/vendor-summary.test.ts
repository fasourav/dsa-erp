import assert from "node:assert/strict"
import test from "node:test"

import {
  catalogCategoryOptions,
  dataColumns,
  sortVendors,
  type VendorSummary,
} from "../src/lib/vendor-summary.ts"

function sampleVendor(overrides: Partial<VendorSummary>): VendorSummary {
  return {
    id: "00000000-0000-0000-0000-000000000001",
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
