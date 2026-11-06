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
  SIDEBAR_MODES,
  sanitizeSidebarMode,
  sidebarModeKey,
  sidebarExpanded,
  sidebarModeLabel,
} = await import("../src/lib/sidebar-mode.ts")

const idle = { pointerInside: false, focusInside: false, menuOpen: false }

test("modes and default", () => {
  assert.deepEqual(SIDEBAR_MODES, ["auto", "open", "closed"])
  assert.equal(sanitizeSidebarMode("open"), "open")
  assert.equal(sanitizeSidebarMode("closed"), "closed")
  assert.equal(sanitizeSidebarMode("weird"), "auto")
  assert.equal(sanitizeSidebarMode(null), "auto")
})

test("storage key is per account, case-insensitive", () => {
  assert.equal(sidebarModeKey(" Owner@Example.com "), "dsa-erp.sidebar.mode:owner@example.com")
  assert.notEqual(sidebarModeKey("a@x.com"), sidebarModeKey("b@x.com"))
  assert.equal(sidebarModeKey(""), "dsa-erp.sidebar.mode:anonymous")
})

test("auto: collapsed when idle, expands on pointer OR focus OR open menu", () => {
  assert.equal(sidebarExpanded({ mode: "auto", ...idle }), false)
  assert.equal(sidebarExpanded({ mode: "auto", ...idle, pointerInside: true }), true)
  assert.equal(sidebarExpanded({ mode: "auto", ...idle, focusInside: true }), true)
  assert.equal(sidebarExpanded({ mode: "auto", ...idle, menuOpen: true }), true)
})

test("locked modes ignore presence", () => {
  assert.equal(sidebarExpanded({ mode: "open", ...idle }), true)
  assert.equal(
    sidebarExpanded({ mode: "closed", ...idle, pointerInside: true, focusInside: true }),
    false,
  )
})

test("labels", () => {
  assert.equal(sidebarModeLabel("auto"), "Auto")
  assert.equal(sidebarModeLabel("open"), "Always expanded")
  assert.equal(sidebarModeLabel("closed"), "Always collapsed")
})
