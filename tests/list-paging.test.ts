import assert from "node:assert/strict"
import module from "node:module"
import path from "node:path"
import test from "node:test"
import { pathToFileURL } from "node:url"

module.registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const target = path.resolve(process.cwd(), "src", `${specifier.slice(2)}.ts`)
      return nextResolve(pathToFileURL(target).href, context)
    }
    return nextResolve(specifier, context)
  },
})

const {
  columnVisible,
  computeTableColumnLayout,
} = await import("../src/lib/list-paging.ts")
const { dataColumns: projectColumns, defaultColumnVisibility: defaultProjectVisibility } =
  await import("../src/lib/project-summary.ts")
const { dataColumns: leadColumns } = await import("../src/lib/lead-summary.ts")
const { dataColumns: clientColumns } = await import("../src/lib/client-summary.ts")
const { dataColumns: vendorColumns } = await import("../src/lib/vendor-summary.ts")
const { clientInvoiceColumns } = await import("../src/lib/client-invoice-summary.ts")
const { receivableColumns } = await import("../src/lib/accounts-receivable.ts")
const { payableColumns } = await import("../src/lib/accounts-payable.ts")
const { expenseColumns } = await import("../src/lib/operational-expenses.ts")

test("Projects 12-column dense layout allocates readable widths and scrolls instead of compressing", () => {
  const layout = computeTableColumnLayout(projectColumns, {
    dense: projectColumns.length >= 10,
    hasActions: true,
  })

  const byId = Object.fromEntries(
    projectColumns.map((col, idx) => [col.id, layout.columnMinWidthsPx[idx]]),
  )

  assert.equal(layout.columnWidths.length, 12)
  assert.equal(layout.actionsWidthPx, 56)
  assert.equal(
    layout.minWidthPx,
    layout.columnMinWidthsPx.reduce((sum, px) => sum + px, 0) + layout.actionsWidthPx,
  )

  // Readable space for names, locations, status/phase pills, progress, and money
  assert.ok(byId.name >= 240, `expected Project Name >= 240px, got ${byId.name}`)
  assert.ok(byId.location >= 200, `expected Location >= 200px, got ${byId.location}`)
  assert.ok(byId.startedOn >= 116, `expected Date >= 116px, got ${byId.startedOn}`)
  assert.ok(byId.status >= 144, `expected Status >= 144px, got ${byId.status}`)
  assert.ok(byId.phase >= 170, `expected Project Phase >= 170px, got ${byId.phase}`)
  assert.ok(byId.progressPercent >= 112, `expected Progress >= 112px, got ${byId.progressPercent}`)
  assert.ok(byId.totalValue >= 128, `expected Total Value >= 128px, got ${byId.totalValue}`)
  assert.ok(byId.grossProfit >= 128, `expected Gross Profit >= 128px, got ${byId.grossProfit}`)

  // 12 columns + actions exceeds a 1440px/1600px container so horizontal scroll engages
  assert.ok(layout.minWidthPx >= 1800, `expected minWidthPx >= 1800, got ${layout.minWidthPx}`)

  const pctSum = layout.columnWidths.reduce((sum, w) => sum + parseFloat(w), 0)
  assert.ok(Math.abs(pctSum - 100) < 0.05)
})

test("Column visibility changes recompute table minimum width and column shares", () => {
  const fullVis = defaultProjectVisibility()
  const compactVis = {
    ...fullVis,
    totalPaid: false,
    totalDue: false,
    expenseTotal: false,
    expenseDue: false,
    grossProfit: false,
  }

  const visible = projectColumns.filter((col) => columnVisible(col, compactVis))
  assert.equal(visible.length, 7)

  const layout = computeTableColumnLayout(visible, {
    dense: visible.length >= 10,
    hasActions: true,
  })

  assert.equal(layout.columnWidths.length, 7)
  assert.equal(layout.actionsWidthPx, 56)
  assert.equal(
    layout.minWidthPx,
    layout.columnMinWidthsPx.reduce((sum, px) => sum + px, 0) + layout.actionsWidthPx,
  )
  assert.ok(layout.minWidthPx <= 1200)

  const pctSum = layout.columnWidths.reduce((sum, w) => sum + parseFloat(w), 0)
  assert.ok(Math.abs(pctSum - 100) < 0.05)
})

test("Core DataList consumers derive consistent purpose-based widths", () => {
  const tables = [
    { name: "Leads", cols: leadColumns },
    { name: "Clients", cols: clientColumns },
    { name: "Vendors", cols: vendorColumns.map((c) => ({ ...c, locked: true })) },
    { name: "Invoices", cols: clientInvoiceColumns },
    { name: "AR", cols: receivableColumns },
    { name: "AP", cols: payableColumns },
    { name: "Expenses", cols: expenseColumns },
  ]

  for (const table of tables) {
    const dense = table.cols.length >= 10
    const layout = computeTableColumnLayout(table.cols, { dense, hasActions: true })

    assert.equal(layout.columnWidths.length, table.cols.length, table.name)
    assert.equal(
      layout.minWidthPx,
      layout.columnMinWidthsPx.reduce((sum, px) => sum + px, 0) + layout.actionsWidthPx,
      table.name,
    )
    for (let i = 0; i < table.cols.length; i += 1) {
      assert.ok(
        layout.columnMinWidthsPx[i] >= 108,
        `${table.name} col ${table.cols[i].id} width ${layout.columnMinWidthsPx[i]} < 108`,
      )
    }
  }

  // Operational Expenses gives extra width to its stacked Category column
  const expLayout = computeTableColumnLayout(expenseColumns, {
    dense: false,
    hasActions: true,
  })
  assert.equal(expLayout.columnMinWidthsPx[1], 260)
})

test("computeTableColumnLayout honors explicit column width and minWidth overrides", () => {
  const cols = [
    { id: "name", label: "Project Name", align: "left" as const, locked: true, width: "240px" },
    { id: "startedOn", label: "Date", align: "left" as const, locked: false, minWidth: 150 },
    { id: "totalValue", label: "Total Value", align: "right" as const, locked: false },
  ]

  const layout = computeTableColumnLayout(cols, {
    dense: true,
    hasActions: true,
  })

  assert.equal(layout.columnWidths[0], "240px")
  assert.equal(layout.columnMinWidthsPx[0], 240)
  assert.equal(layout.columnMinWidthsPx[1], 150)
  assert.equal(layout.actionsWidthPx, 56)
  assert.equal(
    layout.minWidthPx,
    240 + 150 + layout.columnMinWidthsPx[2] + 56,
  )
})
