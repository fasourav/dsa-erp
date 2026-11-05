import assert from "node:assert/strict"
import test from "node:test"

import { catalogDefinitions } from "../src/lib/lookup-catalogs.ts"

test("catalogDefinitions matches Settings Lists display order", () => {
  assert.deepEqual(
    catalogDefinitions.map((catalog) => catalog.label),
    [
      "Departments",
      "Lead Sources",
      "Lead Stages",
      "Lead Statuses",
      "Project Types",
      "Project Phases",
      "Project Expense Categories",
      "Vendor Work Categories",
      "Office Expense Categories",
      "Asset Categories",
      "Payment Methods",
    ],
  )
})
