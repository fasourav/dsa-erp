import assert from "node:assert/strict"
import test from "node:test"

import {
  computeTableColumnLayout,
  type ListColumn,
} from "../src/lib/list-paging.ts"

test("computeTableColumnLayout assigns deterministic widths independent of row content", () => {
  const vendorCols: ListColumn<string>[] = [
    { id: "displayName", label: "Vendor Name", align: "left", locked: true },
    { id: "vendorField", label: "Category", align: "left", locked: true },
    { id: "contact", label: "Contact", align: "left", locked: true },
    { id: "totalProjectValue", label: "Total Project Value", align: "right", locked: true },
    { id: "totalPaid", label: "Total Paid", align: "right", locked: true },
    { id: "totalDue", label: "Total Due", align: "right", locked: true },
  ]

  const layout = computeTableColumnLayout(vendorCols, {
    dense: false,
    hasActions: true,
  })

  assert.equal(layout.columnWidths.length, 6)
  assert.equal(layout.actionsWidthPx, 80)
  // Fits comfortably on standard 1280px+ desktops without horizontal scroll
  assert.ok(layout.minWidthPx > 800 && layout.minWidthPx < 1050)
  // Primary name column gets wider share than numeric columns
  assert.ok(parseFloat(layout.columnWidths[0]) > parseFloat(layout.columnWidths[4]))
})

test("computeTableColumnLayout honors explicit column width and dense mode", () => {
  const cols: ListColumn<string>[] = [
    { id: "name", label: "Project Name", align: "left", locked: true, width: "240px" },
    { id: "startedOn", label: "Date", align: "left", locked: false },
    { id: "totalValue", label: "Total Value", align: "right", locked: false },
  ]

  const layout = computeTableColumnLayout(cols, {
    dense: true,
    hasActions: true,
  })

  assert.equal(layout.columnWidths[0], "240px")
  assert.equal(layout.actionsWidthPx, 52)
})
